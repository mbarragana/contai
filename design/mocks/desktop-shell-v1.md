# desktop-shell-v1 — Reformulação da experiência desktop (pós-rejeição do CONTAI-039)

## Por que este documento existe

O CONTAI-039 implementou o Conceito 2 que eu mesmo propus: alargar a casca
para 1280px e distribuir os `Card`/`Chip`/`Consequencia` — desenhados para
430px — numa grade de 2 colunas. O Mateus rejeitou o resultado: *"ficou
horrível a tela, ficou várias telas de celular lado a lado, eu quero uma
experiência de desktop."*

Diagnóstico do próprio spec do CONTAI-039 (`design/mocks/CONTAI-039.md`,
decisão 1): a largura de cada card foi ajustada para **ficar igual ao card do
celular** ("394px de conteúdo... praticamente a mesma largura de hoje, só que
duas lado a lado"). Isso não é acidente de implementação — é a decisão de
design *pedindo* para o resultado ser mobile espremido. O problema não estava
no Gate 1/2, estava na Pergunta 1 do ticket anterior.

**Restrição nova, literal do Mateus**: *"o uso atualmente é 100% desktop"* e
*"se tiver que quebrar a compatibilidade com o mobile pode quebrar."* Isso
substitui — para esta superfície — a doutrina de "375px é piso" do
`CLAUDE.md` (o `po` está registrando o pivô formalmente). Este documento
propõe uma **reformulação real**, não uma variação do grid de 2 colunas.

## Campos
- SEM CAMPOS — este documento é a exploração que originou os tickets
  CONTAI-040/041/042; nenhum campo novo é capturado aqui. Cada ticket
  derivado, se precisar de campo novo, declara sua própria seção `## Campos`
  no spec dele.

## Cenário

**Gestão, em casa, sentado, monitor largo** — o mesmo cenário do CONTAI-039,
mas agora sem a obrigação de preservar os componentes mobile intactos nem o
piso de 375px nesta superfície. O "Teste do Canteiro" nunca se aplicou aqui e
continua não se aplicando.

## Conceito único: shell de gestão com sidebar + dashboard + tabela

Um conceito forte, não três fracos. Estrutura:

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ contai       │ Visão geral                          [Ano ▾] [+ Novo ▾]  │
│──────────────│ Cachoeira do Bom Jesus · 2026                            │
│ OBRA ABERTA  ├──────────────────────────────────────────────────────────┤
│ Cachoeira do │                                                          │
│ Bom Jesus    │  ┌─ Custo confirmado ─┐ ┌─ Custo em risco ─┐ ┌─ INSS ─┐  │
│ CNO ...·2026 │  │ R$ 132.400,00      │ │ R$ 25.950,00     │ │R$14.300│  │
│ [Trocar ▾]   │  │ acumulado 932.400  │ │ decomposição 3x  │ │ base   │  │
│──────────────│  └─────────────────────┘ └───────────────────┘ └────────┘│
│ Visão geral ●│                                                          │
│ Despesas     │  ┌─ Pendências urgentes ──────┐ ┌─ Despesas recentes ──┐ │
│ Pendências 9 │  │ (4 mais graves + link)     │ │ (4 últimas + link)   │ │
│ Obras        │  └─────────────────────────────┘ ├─ Agenda ─────────────┤│
│──────────────│                                   │ (compromissos)      ││
│ Dados da obra│                                   └──────────────────────┘│
│ Terreno      │                                                          │
│ Sua conta    │                                                          │
│ Sair         │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

### Por que isto não é "cards de celular lado a lado"

1. **Nenhum componente mobile é reaproveitado como está.** `Card`, o
   `Consequencia` de 12.5px em bloco estreito e o headline de 26px pensado
   para 394px de largura não aparecem aqui. Os KPIs do dashboard usam
   tipografia de 32px, padding generoso (20-22px) e uma decomposição em
   mini-tabela dentro do próprio tile — não uma pilha de `Dica`.
2. **Densidade de informação por área de tela é maior**, não igual. A home
   mobile mostra ~4-6 blocos por rolagem de 740px de altura; o dashboard
   mostra os 3 números-chave, 4 pendências e 4 despesas recentes **sem
   rolar**, em 1024px de largura.
3. **Sidebar persistente**, não rodapé de app. Navegação é permanente à
   esquerda, no padrão de qualquer ferramenta de gestão (contabilidade,
   ERP, dashboard financeiro) — não uma barra de abas que soma ao scroll do
   conteúdo.
4. **Tabela de verdade para despesas**, não uma lista de cards empilhados
   com grid por baixo. Colunas, ordenação por cabeçalho, filtro e busca.

## Shell de navegação

Sidebar fixa, 264px, fundo escuro (`--side-bg`) — deliberadamente diferente
do "papel" claro do app mobile, para o rail de navegação nunca ser confundido
com conteúdo. Do topo para baixo:

1. **Marca** ("contai").
2. **Obra aberta** — nome, CNO, ano, botão "Trocar obra". A obra continua
   sendo um contexto GLOBAL da sessão (não uma aba): tudo no shell — KPIs,
   tabela, pendências — é sempre desta obra. Trocar de obra troca o contexto
   inteiro, como hoje.
3. **Navegação primária**, 4 itens:
   - **Visão geral** (dashboard) — rota real seria `/` (adaptando o
     `app/page.tsx` atual).
   - **Despesas** — rota nova, ex. `/despesas`. Não existe hoje; nasceria
     desta reformulação.
   - **Pendências** — já existe (`/pendencias`), mas hoje é alcançável só
     por link de rodapé dentro de cada pendência de correção. Ganha
     superfície de primeira classe no shell, com contador de abertas no
     próprio item de menu (badge vermelho).
   - **Obras** — já existe (`/obras`).
4. **Navegação secundária** (links menores, sem ícone de destaque): Dados da
   obra, Terreno, Sua conta, Sair — o que hoje vive como `Dica` de rodapé da
   home mobile.

Nenhum item de navegação nasce e morre a partir de conteúdo condicional: a
sidebar é idêntica em toda tela — diferente da home mobile, onde o rodapé de
navegação varia com o que está carregado.

### Barra superior (dentro do shell, acima do conteúdo)

- Título da página (muda por view) + subtítulo com obra/ano ou contagem.
- Seletor de ano (só aparece nas views Dashboard/Despesas — Pendências e
  Obras não são recortadas por ano-calendário).
- **"+ Novo registro"** — substitui o FAB/`BarraAdicionar` fixo do mobile.
  Vira um botão primário fixo no topbar com um menu suspenso de 3 opções
  (Documento / Pagamento / Compra no cartão), reaproveitando literalmente os
  rótulos e descrições de `app/adicionar/page.tsx` — **este texto não é
  fiscal, é copy de produto, então reaproveitar é decisão de design, não
  parecer**. A tela `/adicionar/*` em si (captura) não muda: continua sendo
  fluxo mobile-first governado pelo Teste do Canteiro — só o PONTO DE
  ENTRADA no desktop muda de lugar (do rodapé fixo para o topbar).

## Dashboard (Visão geral)

**O que fica na tela principal**: um resumo dos três números fiscais, nunca a
lista inteira empilhada. Quem quer o detalhe completo vai para Despesas ou
Pendências — o dashboard é ponto de partida, não substituto.

### Linha de KPIs (3 tiles, lado a lado)

Cada tile é um componente NOVO (não é `Card` mobile redimensionado):
tipografia maior (32px para o número), borda superior de 3px na cor da
gravidade, padding 20-22px.

1. **Custo confirmado no ano** — verde. Número + linha "Acumulado do imóvel"
   + a frase completa "= situação em 31/12 na ficha Bens e Direitos (terreno
   + obra). Nada é somado com as outras obras." (texto de
   `app/page.tsx`, sem reescrita).
2. **Custo em risco no IR** — vermelho (ou verde se zerado, seguindo a regra
   já existente em `CardCustoEmRisco`: zero é fato bom e muda de cor). Número
   + a decomposição em 3 linhas **sempre visível** (R4 do CONTAI-005 não
   muda: *"o total nunca aparece sem a decomposição visível"*) + a frase de
   imposto estimado (`textoImpostoAte`).
3. **Aferição do INSS (base)** — âmbar, só aparece com CNO (mesma condição de
   hoje). Número em base (nunca em reais de imposto) + a frase
   `INSS_NAO_E_IMPOSTO` + a frase de fechamento `INSS_CONTINUAM_VALENDO_NO_IRPF`
   em verde — a mesma trinca de textos do card mobile, só que lado a lado dos
   outros dois em vez de empilhada abaixo.

Todos os textos de consequência nos três tiles são **cópia literal** das
constantes já existentes em `lib/fiscal/risco.ts` (ver mock HTML linha a
linha) — nenhuma frase nova.

### Abaixo dos KPIs: dois painéis lado a lado (não três colunas de cards)

- **Pendências mais urgentes** (mais largo, ~63% da largura): as 4
  pendências de maior gravidade/valor, no MESMO formato compacto que a versão
  completa da view Pendências (chip + título + detalhe + valor), com link
  "Ver todas (N) →" que troca para a view Pendências. Não é uma cópia
  resumida com texto reescrito — é um subconjunto dos mesmos itens.
- **Coluna direita** (~37%), dois painéis empilhados:
  - **Despesas recentes**: as 4 despesas comprovadas mais recentes (data +
    favorecido + valor), link "Ver todas (N) →" para a view Despesas.
  - **Agenda — próximos compromissos**: reaproveita a ideia de
    `BlocoAgendados` (compromisso ≠ pendência fiscal, fica visualmente
    separado, sem chip fiscal).

## Despesas — tabela de verdade

Rota nova (`/despesas`, a implementar). Substitui, para a visão de gestão, a
necessidade de rolar a home inteira para ver "despesas comprovadas" +
"pendências" juntas — aqui elas convivem na MESMA tabela, o que é a resposta
literal ao pedido do Mateus ("despesas em formato de tabela").

### Colunas
`Data pagamento` (sortável) · `Favorecido` (+ tipo PF/PJ) · `Documento` (tipo
+ número, ou o texto que falta: "sem NF vinculada") · `Meio` (PIX/Boleto/
Cartão) · `Valor` (sortável) · `Situação` · `Ação`.

### A coluna Situação é a peça central da Meta 1 nesta tela

Uma linha **comprovada** (verde) é compacta: só o chip. Uma linha com
**pendência** tem o chip **e**, na mesma célula, a `Consequencia` completa
(texto integral, sem truncar, sem "..." e sem exigir clique) — a linha da
tabela cresce em altura para caber o texto, exatamente porque agora há espaço
para isso. Isso é a aplicação direta da liberdade nova: *"numa tela larga uma
linha de tabela pode ser alta o suficiente para caber a Consequência
inteira."* A consequência **nunca fica atrás de um clique** — doutrina do
produto (a consequência aparece na interface, não como asterisco).

Cada tipo de pendência hoje modelado em `lib/fiscal/resumo.ts` tem uma linha
de exemplo no mock, com o texto exato da constante correspondente:
quarentena, boleto sem NF (âmbar, com a nota "não entra no total"), pago sem
nota (PF e PJ), pago sem comprovante (PF vermelho / PJ âmbar, a exceção
nomeada), retenção sem recolhedor (vermelho por exceção — CONTAI-038), nota
sem CNO (âmbar), diferença sem explicação.

### Filtros e ordenação (implementados de verdade no mock)
- Situação: Todas / Só comprovadas / Só com pendência.
- Tipo de documento: Todos / NF material / NF serviço / Boleto / Sem
  documento.
- Busca por favorecido (texto livre).
- Ordenação por clique no cabeçalho: Data pagamento (padrão: mais recente
  primeiro) e Valor.

**Perguntas em aberto para o `po`** (a tabela precisa de dado que não sei se
existe hoje pronto para consulta):
1. A tabela deve ser só desta obra (como a home hoje) ou ganhar uma coluna
   "Obra" e mostrar todas de uma vez com filtro? O mock assume **só a obra
   aberta**, para não reabrir a discussão de "nada se soma entre obras" — mas
   o Mateus pode querer visão consolidada aqui, e nesse caso cada linha
   precisaria nomear a obra sem nunca somar valores entre elas (mesma regra
   do `Linha` em `/pendencias`, crit. 14 do CONTAI-003/`app/obras`).
2. Paginação: a obra tem ~20 meses de lançamentos. A tabela cresce sem
   paginação decidida — proponho carregamento único com scroll (a mesma
   filosofia do `Corpo` hoje) até medirmos o volume real, mas é uma decisão
   do `po`/`cto-obra`, não minha.

## Pendências — superfície própria

Rota já existe (`/pendencias`) mas hoje só cobre a pendência **persistente**
de correção/CNPJ errado (ver `app/pendencias/page.tsx`) — não as pendências
**derivadas** que hoje só aparecem na home (quarentena, pago sem nota, etc.).

**Proposta**: a view Pendências do shell passa a agregar TUDO que hoje é
`ResumoObra.pendencias[]` (as derivadas, recalculadas a cada carga) mais o
que já existe em `/pendencias` (as persistentes, gravadas com histórico).
Agrupadas por gravidade (Vermelho primeiro, depois Âmbar), nunca misturadas
sem hierarquia, nunca com paginação escondendo a mais grave.

Cada item ocupa a largura toda: chip + título + detalhe à esquerda, valor à
direita, botão de ação, e a `Consequencia` **sempre visível**, em linha
própria abaixo, span da largura inteira do item — nunca truncada, igual à
doutrina da tabela de Despesas.

⚠️ Isto é uma proposta de **unificação de fonte de dados** (derivadas +
persistentes na mesma tela), não só de layout — cabe ao `po`/`cto-obra`
avaliar se a página `/pendencias` deve mesmo absorver as derivadas ou se elas
continuam exclusivas da Dashboard/Despesas. Registro como pergunta aberta,
não decisão.

## Obras

Mantém a lista simples que já existe hoje (`/obras`), com cada obra em uma
linha própria (nome, CNO, situação), nunca com valores de duas obras lado a
lado (crit. 14 já vigente). Não é o foco desta rodada — incluída no shell
para a sidebar não ter item morto — mock em fidelidade mais baixa.

## O que muda em relação ao app mobile hoje

- `app/page.tsx` deixa de ser a fonte da experiência desktop. Ele continua
  existindo tal como está para telas < certo breakpoint (mobile real), e o
  shell novo é uma composição separada para desktop — **não uma variação
  condicional do mesmo componente**, ao contrário do que o CONTAI-039 tentou.
  Onde exatamente o corte de breakpoint acontece, e se as duas experiências
  compartilham dado (`calcularResumo`, `carregarPainel...`) mas não
  componente visual, é decisão de arquitetura do `cto-obra` — este documento
  não prescreve implementação, só a experiência.
- `/adicionar/*` (captura) **não muda** — continua sendo o fluxo mobile-first
  de sempre. Só o ponto de entrada, no desktop, muda de lugar.
- Nasce a necessidade de uma rota `/despesas` que hoje não existe.
- `/pendencias` ganha (proposta, a confirmar com `po`) as pendências
  derivadas que hoje só vivem na home.

## Textos fiscais — origem de cada um (nenhum foi reescrito)

| Texto | Fonte |
|---|---|
| "Não entra no custo de aquisição. Peça a nota no seu CPF." | `CONSEQUENCIA_QUARENTENA`, `lib/fiscal/documento.ts` |
| "Boleto não é documento hábil..." / "Não entra no total acima..." | `CONSEQUENCIA_BOLETO` / `BOLETO_FORA_DO_TOTAL`, `lib/fiscal/documento.ts` |
| "Custo não se sustenta no IR até o recibo/a NF chegar..." | `rotulosPagoSemNota` (PF/PJ), `lib/fiscal/pagamento.ts` |
| "sem o comprovante da transferência..." / "pago sem comprovante — o custo existe..." | `rotulosPagoSemComprovante` (PF/PJ), `lib/fiscal/pagamento.ts` |
| "R$ X do que você pagou ainda estão sem explicação..." | `textoDiferencaSemExplicacao`, `lib/fiscal/pagamento.ts` |
| "Retenção descontada do pagamento sem confirmação de quem recolhe..." | `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR`, `lib/fiscal/retencao.ts` |
| "Esta nota não abate a aferição desta obra..." | `CONSEQUENCIA_CNO_DA_NOTA`, `lib/fiscal/obra.ts` |
| Blocos 1/2 do dashboard (custo em risco, INSS) | `lib/fiscal/risco.ts`, constantes citadas no HTML |
| "= situação em 31/12 na ficha Bens e Direitos..." | `app/page.tsx` (já em produção) |

Nenhum desses textos foi validado de novo com o `contador` porque nenhum é
novo — é reposicionamento, igual ao que o CONTAI-039 já havia estabelecido
como não exigindo nova consulta fiscal.

## Perguntas em aberto (para `po` e `cto-obra`, não decisões minhas)

1. **Escopo de obra na tabela de Despesas** — só a obra aberta, ou
   consolidado com coluna Obra? (acima, seção Despesas)
2. **Paginação/volume** da tabela de Despesas.
3. **Unificação de pendências derivadas + persistentes** na view Pendências
   — endosso de produto necessário antes de virar ticket.
4. **Breakpoint exato e estratégia de código** para separar shell desktop de
   `app/page.tsx` mobile — arquitetura, não design.
5. Rótulo da view "Despesas": inclui pagamentos avulsos ainda sem nenhum
   documento (ex.: PIX cru, sem nada vinculado) ou só o que já tem pelo menos
   um lado (documento OU pagamento) registrado? O mock assume que sim — toda
   linha de `pagamentos` e `documentos` aparece, comprovada ou não — mas é o
   `po` quem fecha isso.

## Arquivos

- `design/mocks/desktop-shell-v1.html` — protótipo navegável (Dashboard →
  Despesas → Pendências → Obras, pela sidebar; filtro/ordenação funcionais na
  tabela de Despesas; menu "+ Novo registro" funcional).
- `design/mocks/desktop-shell-v1.md` — este documento.
