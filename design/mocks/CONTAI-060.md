# CONTAI-060 — seletor de ano no shell (Home + Despesas + Pendências)

Cenário: **gestão** (shell, em casa, sentado). Teste do Canteiro não se aplica; `(captura)` fica fora do provedor, por desenho.

**Nível confirmado: 2.** O controle nasce dentro do slot que já existe — o subtítulo de `MolduraDeGestao` (`shell.tsx`) — sem rota, sem estado de tela nova, sem deslocar layout; estruturalmente igual aos `<select>` de Situação/Tipo já existentes em `/despesas` (nível 2 também). A complexidade real do ticket (4 usos de `anoCorrente`, encanamento de estado) é engenharia já resolvida na Viabilidade do CTO — não sobra decisão de layout em aberto para o lead-engineer.

## Campos

- SEM CAMPOS — o **seletor de ano** (grupo de botões, não `<select>`) não é
  campo fiscal e não é campo nenhum: não grava nada, só escolhe o que a tela
  LÊ. Valor inicial sempre o ano corrente real; "todos" nunca é default.

## 1. Onde e forma exata

Substitui o fragmento `· {ano}` do subtítulo **só** nas duas views onde `subtituloDaView` hoje monta `"{obra} · {ano}"`: Visão geral (`/`) e Despesas (`/despesas`) — quando a tela não publica cabeçalho próprio (`!daTela`) e não é `/pendencias` nem `/obras`. Fora dessas duas rotas o subtítulo não muda.

```
Casa Tanheiros ·  [2026] [2025]  |  [Todos os anos]
                    ▔▔▔▔ ativo
```

- `role="group" aria-label="Ano em exibição"`; rótulo **"Todos os anos" por extenso**, separado dos anos por um traço vertical (`border-l border-line`) — a separação visual, não só o texto, torna a opção inconfundível com mais um ano na fila (critério 3).
- Botão reusa o padrão já existente de `corrigir.tsx` (`aria-pressed`): ativo `border-ink bg-ink text-paper`; inativo `border-line text-mut hover:bg-soft`. Compacto (~11px, `rounded-full px-2 py-0.5`), sem alvo de 44px — cenário gestão, mouse.
- Ordem: anos decrescentes (mais recente primeiro), traço, "Todos os anos" por último. Anos ofertados = `anosDaObra(painel)` **unida** ao ano corrente real — nunca vazia, nem numa obra sem pagamento nenhum ainda.
- Clique chama `escolherAno(n | null)` do contexto; nunca `<Link>`, nunca query param.
- **Estados**: herdados do `ProvedorDeGestao` — o subtítulo já não renderiza nada fora de `fase === "pronto"` com obra aberta (hoje). Loading/erro/sem-obra: nenhuma pílula aparece; nada de estado novo.

## 2. Home — KPI sob "todos os anos" (critério 3)

| | ano = N | ano = `null` |
|---|---|---|
| Rótulo | `Custo confirmado em {N} · {obra}` (sem mudança) | `Custo confirmado, acumulado em todos os anos · {obra}` |
| Número | `custoConfirmadoAnoCentavos` (sem mudança) | `acumuladoImovelCentavos` |
| Linha "Acumulado desta obra: X" | mostrada (sem mudança) | **omitida** — repetiria o headline |
| Zero-explicação | `custoConfirmadoAnoCentavos === 0` | `acumuladoImovelCentavos === 0` — mesmo texto, campo certo |

Resto do tile (moldura "31/12", "Terreno nesta soma", "Gasto real", despesas comprovadas): **nenhuma palavra muda** — não nomeiam ano específico, e o valor já sai certo porque `calcularResumo` recebe o ano corrente real internamente sob "todos" (Viabilidade do CTO).

**Regra geral de texto** (vale para os itens 3 e 4): onde a tela hoje diz "em {ano}", com `ano === null` o trecho vira **"em todos os anos"**, por extenso, sempre.

## 3. `/despesas` — contagem e filtro (critério 4)

- `linhasDoAno` = `linhas` filtradas só pelo ano (`ano === null || linha.dataPagamento === null || anoCalendario(...) === ano`) — mesma regra que protege a linha sem data (critério 5).
- `visiveis` = `linhasDoAno` + filtros de Situação/Tipo/Busca (como hoje).
- `total` da barra vira `linhasDoAno.length`, não mais o total de todos os anos — senão "N de M" compara janelas diferentes, o erro que originou o ticket.
- Contagem: `"{total} lançamento(s) em {ano|todos os anos}"` (iguais) / `"{visiveis} de {total} lançamentos em {ano|todos os anos}"` (diferentes).
- `semRegistro` (obra sem nada) continua em `linhas.length` sem filtro de ano — "a obra tem algo, alguma vez", não "neste ano".
- **Estado novo**: `linhasDoAno.length === 0 && linhas.length > 0` — banner âmbar "Nenhum lançamento em {ano}." + "A obra tem {linhas.length} lançamentos em outro(s) ano(s) — troque o ano no topo da tela." Sem botão "Mostrar todos" (só reseta Situação/Tipo/Busca, não resolveria).
- Banner de "filtro escondendo" (Situação/Tipo/Busca zeram a lista) passa a citar `linhasDoAno.length` + "em {ano|todos os anos}".

Linha sem `dataPagamento` (critério 5): já renderiza com `SEM_DADO` na Data, sem mudança visual — só o predicado acima garante que ela some de todo total monetário mas nunca de `linhasDoAno`/`visiveis`, em nenhum ano.

## 4. `/pendencias` (de graça, critério 2)

- `EscopoDaLista({ obra, ano })`: `ano` vira `number | null`; "apuradas em {ano}." → "apuradas em todos os anos." quando `null`.
- `NadaAberto({ obra, ano })` (compartilhado com a Home): mesma troca — "...em {ano}." → "...em todos os anos."
- Badge e fila já vêm do mesmo `useMemo` do provedor — nada a desenhar.

## Decisões e perguntas abertas

- Controle só aparece em Home/Despesas, não em Pendências/Obras — apoiado na Viabilidade do CTO (o slot só existe nessas duas). Trocar "num lugar" refletindo nas três telas (critério 2) não exige o controle visível nas três, só estado único.
- Fora do escopo: "Despesas recentes" da Home segue implicitamente escopado ao ano corrente real mesmo sob "todos" (fallback interno do `calcularResumo`) — não é regressão nova, não é tocado aqui; malha para o `po` avaliar se vale ticket próprio.
- Nenhuma pergunta bloqueante: fiscal já ratificado (`docs/pareceres/2026-09-26-regime-caixa-dado-incompleto-escopo-ano.md`), mecanismo já decidido pelo `cto-obra`.
