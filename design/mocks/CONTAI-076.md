# CONTAI-076 — Agenda no menu lateral do shell de gestão

**Cenário: gestão** (em casa, sentado). Item de navegação no shell
(`app/_components/shell.tsx`), sem tela nova, sem campo novo, sem estado novo.
375px não é régua aqui — a faixa estreita já rola horizontalmente
(`overflow-x-auto`, `shell.tsx:175`) e recebe o item novo pela mesma lista que
alimenta a sidebar, sem redesenho.

## Nível do mock: **Nível 3 (tabela antes/depois)**

Decisões de rótulo, posição e mecanismo já fechadas pelo `cto-obra` no Passo 3
— nada disto é decisão minha, só formalização para o `lead-engineer` não
adivinhar qual função/linha muda.

---

## Tabela do que muda, por arquivo/tela

| Onde | Antes | Depois |
|---|---|---|
| `lib/gestao/navegacao.ts` — `VIEWS_DE_GESTAO` | 4 itens: Visão geral `/`, Despesas `/despesas`, Pendências `/pendencias`, Obras `/obras` | 5 itens, nesta ordem: Visão geral, Despesas, Pendências, **Agenda `/compromisso`**, Obras |
| `lib/gestao/navegacao.ts` — `VIEW_DA_ROTA_DE_DETALHE` | linha `["/compromisso", "/"]` faz `/compromisso` e subrotas contarem como view "Visão geral" | **linha removida**. Com `/compromisso` dentro de `VIEWS_DE_GESTAO`, `ehViewAtiva` já casa `/compromisso` e `/compromisso/[id]...` por prefixo direto — a entrada na tabela de exceção ficaria redundante e voltaria a acender "Visão geral" por engano |
| `lib/gestao/navegacao.ts` — `RAIZES_DE_DETALHE.compromisso` | `mae: { href: "/compromisso", rotulo: "Agendados" }`, `daRaiz: { href: "/", rotulo: "Visão geral" }` | `mae: { href: "/compromisso", rotulo: "Agenda" }` (rótulo acompanha o novo nome da view). **`daRaiz` removido** — `/compromisso` virou view de primeira classe (mesmo padrão de `obras`/`pendencias`, que também não têm `daRaiz`: topo de navegação não volta para lugar nenhum) |
| `lib/gestao/navegacao.ts` — `subtituloDaView` | sem cláusula própria para `/compromisso`; cairia na cláusula genérica do fim (`${nomeDaObra} · ${ano}` quando `ctx.ano` não é `null`) | nova cláusula **antes** da genérica: `if (ehViewAtiva(pathname, "/compromisso")) return ctx.nomeDaObra;` — devolve só o nome da obra (ou `null` sem obra aberta), nunca o ano. Agenda não tem recorte por ano-calendário, então não pode herdar o `· {ano}` que Visão geral/Despesas mostram |
| **Sidebar (desktop, `lg+`)** | 4 links | 5 links, "Agenda" na 4ª posição (antes de "Obras"). Sem badge (badge é só de `/pendencias`, condição já existente não muda) |
| **Faixa estreita (mobile)** | 4 pílulas roláveis + "+ Novo registro" fixo à direita | 5 pílulas roláveis (mesma lista, mesmo `overflow-x-auto`) + "+ Novo registro" continua fixo à direita, fora da área rolável — nenhuma mudança de estrutura, só mais um item na mesma malha |
| `app/(gestao)/compromisso/page.tsx` | Chama `CabecalhoDaTela` com `titulo="Agendados"` (3 ocorrências: carregando/erro/pronto) e `sub={obra.nome}` | **Para de chamar `CabecalhoDaTela`** nas 3 fases — mesmo padrão de `/obras`, `/despesas`, `/pendencias` (família "view de primeira classe", título vem da rota). Renderiza só `ColunaDeDetalhe` com o conteúdo (Carregando/EstadoErro/Banner/BlocoAgendados), como já fazem as outras views-lista. Título "Agenda" e subtítulo (nome da obra, sem ano) passam a vir do shell via `tituloDaView`/`subtituloDaView`, automático nos 3 estados — inclusive carregando, porque o título não depende do dado carregado |
| `app/(gestao)/compromisso/[id]/page.tsx` | Breadcrumb do shell mostra "‹ Agendados" (de `RAIZES_DE_DETALHE.compromisso.mae.rotulo`) | **Nenhuma linha muda neste arquivo.** O crumb passa a mostrar "‹ Agenda" só porque o rótulo mudou na fonte de dados (`navegacao.ts`, ver linha acima) — o componente que renderiza é `shell.tsx`, já genérico |
| `app/(gestao)/compromisso/[id]/{valor,cancelar,data,confirmar}/page.tsx` | Crumb sobe para `/compromisso/[id]` ("‹ Agendamento") | **Sem mudança** — essas subrotas têm 3 segmentos, caem no ramo final de `migalhaDaRota` (`entrada.rotulo`), que não foi tocado |
| **Home** (`app/(gestao)/page.tsx`) | "ver todos (N)" leva a `/compromisso` | **Sem mudança** — link adicional pelo menu, não substituição (critério do backlog) |

---

## Os 4 estados de `/compromisso`

Nenhum estado novo. Carregando/erro/vazio/sucesso continuam exatamente como
hoje dentro de `ColunaDeDetalhe`; a única diferença observável é que título e
subtítulo agora vêm do topbar do shell em vez de um `CabecalhoDaTela` local —
mesma informação, outra origem.

## Campos

- SEM CAMPOS — navegação pura, nenhum dado fiscal tocado, nenhum default.

## Verificação sugerida

`navegacao.test.ts` (já existe e cobre `VIEWS_DE_GESTAO`/`ehViewAtiva`/
`migalhaDaRota`): adicionar caso para a 5ª posição, para `ehViewAtiva("/compromisso/abc", "/compromisso")` continuar `true` sem a linha removida de
`VIEW_DA_ROTA_DE_DETALHE`, e para `migalhaDaRota("/compromisso")` devolver
`null` (sem crumb, é topo de navegação agora).
