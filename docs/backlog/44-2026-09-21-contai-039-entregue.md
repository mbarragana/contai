# CONTAI-039 entregue — 2026-09-21 — home ganha layout desktop

Convergência (`docs/backlog/43-2026-09-21-convergencia-home-desktop.md`)
virou código: a partir de `lg` (1280px), a home renderiza em duas colunas —
`<aside>` sticky com a posição fiscal (custo confirmado, custo em risco,
aferição INSS) à esquerda, fila de pendências/despesas/notas/terreno/
financiamento em grid de 2 colunas à direita, na mesma ordem fiscal de
sempre. Abaixo de `lg`, tudo bit a bit idêntico ao layout mobile de hoje.

Gate 2 achou e corrigiu um bug real, não hipotético: o aside sticky escondia
`CardAfericaoInss` sempre que a régua fiscal ficava mais alta que a
viewport — já acontecia no cenário mínimo do seed. Corrigido com scroll
próprio no aside (`lg:max-h-full lg:overflow-y-auto`, referência ao `main`).

Segundo achado do Gate 2, mais importante para o resto do app: o `lg:max-w`
da casca e o espaçador do rodapé (`BarraAdicionar`) não podiam ser globais —
mediram que as outras ~43 telas (captura e detalhe) esticariam para 1244px
em coluna única, piorando a legibilidade do texto de `Consequencia`. Em vez
de aceitar isso como dívida (cogitado pelo `po`, chegou a ganhar um número
provisório D67), o `cto-obra` propôs um mecanismo **opt-in por página**:
`Corpo` ganha `largo?: boolean` (tipado, não spread — segunda rodada de
review), que emite `data-largo`; `app/layout.tsx` só abre a casca para
1280px via `:has([data-largo])`; `BarraAdicionar` só ganha o espaçador via
`alinharComFila`. Só a home ativa os dois. **D67 nunca chegou a ser
registrada** — o efeito colateral foi eliminado, não documentado como custo
aceito.

Testado: 839 unitários + 242 E2E (240 mobile inalterados + 2 desktop novos,
um deles travando especificamente que as outras telas não ganham `data-largo`)
+ validação manual no browser em 1280px (régua sticky com scroll próprio,
grid 2 colunas, nenhum texto de consequência cortado, outras telas
intocadas). Gate 4 (`po`) PASS, 12/12 critérios. Sem migration, sem dívida
nova.

Fica para rodada futura, sem ticket ainda: estender o padrão `aside`+`Secao`
às telas de detalhe (`/documento/[id]`, `/pagamento/[id]`) e correção, que
hoje continuam em coluna única de 430px mesmo em desktop — não é regressão,
é escopo que este ticket deliberadamente não cobriu (Out of Scope).
