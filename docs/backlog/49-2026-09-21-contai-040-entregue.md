# CONTAI-040 entregue — 2026-09-21 — shell de navegação desktop + dashboard

Segundo ticket da sequência "desktop shell". Separação estrutural por route
group do Next 16 — não breakpoint/media query, decisão do `cto-obra` desde
o Gate 0: `app/(gestao)/` hospeda a experiência nova (sidebar 264px + faixa
mínima abaixo do breakpoint desktop, dashboard "Visão geral", `/despesas`
stub, `/pendencias`, `/obras`) atrás de um `ProvedorDeGestao` único (obra
ativa + ano + `unificarPendencias()` lidos uma vez); `app/(captura)/`
mantém a casca de 430px de sempre, ~40 telas movidas sem mudança de
comportamento. Os hacks do CONTAI-039 (`Secao`, `Faixa`, `largo`,
`alinharComFila`, `data-largo`, `:has()` no layout) foram apagados — a home
velha era o único consumidor.

Dashboard: 3 tiles de KPI (custo confirmado, custo em risco, aferição
INSS) reproduzindo verbatim todas as condicionais fiscais dos cards
antigos — nenhuma string fiscal hardcoded, lidas direto das constantes
vigentes. Painéis de pendências urgentes (mesmo componente de `/pendencias`,
badge da sidebar vindo de `unificarPendencias().abertas` — fonte única),
despesas recentes, notas sem pagamento e agenda. "+ Novo registro" no
topbar reaproveita a copy de `/adicionar/page.tsx` sem tocar no arquivo —
travado por teste que lê o arquivo-fonte.

Gate 2 (cto-obra + po + contador, os três em paralelo) com 1 rodada de
rework: `OPCOES_DE_REGISTRO` tinha nascido duplicada em `shell.tsx` —
extraída para `lib/gestao/navegacao.ts` com teste-trava (verbatim contra
`app/(captura)/adicionar/page.tsx`, só leitura).

Decisões de produto do Gate 1, tomadas pelo `po` (registradas em
`docs/backlog/48-2026-09-21-gate1-decisoes-contai-040.md`):
- Seletor de ano fica como TEXTO no subtítulo nesta rodada (não controle
  funcional) — mudar o ano só no dashboard sem sincronizar com
  `/pendencias` quebraria a exigência do Gate Fiscal do CONTAI-042 de
  ambos usarem o mesmo ano. Ticket futuro, não numerado: "seletor de ano
  sincronizado dashboard + /pendencias", P1.
- Painel de pendências usa os cards COMPLETOS de `ItemDaFila`, divergindo
  do mock original (linha compacta) — 11 das 18 famílias só têm texto
  fiscal disponível nos componentes já existentes, e montar linha compacta
  exigiria reescrever texto fiscal (proibido). Mock corrigido para não
  ficar desatualizado como fonte de verdade.
- `/despesas` nasceu como stub (aviso + lista de comprovadas) para não
  perder superfície entre este ticket e o CONTAI-041.
- `terreno_sem_registro` sai do painel do dashboard (duplicaria a mesma
  frase do KPI de custo confirmado) mas continua na fila completa e na
  contagem — não é D46/D47, confirmado pelo `contador`.

Testado: 877 unitários (+18 do teste-trava) + 248 E2E (240 mobile + 8
desktop) + validação manual extensa no browser (sidebar navegando,
dashboard com dado real, "+ Novo registro" preservando o fluxo de
captura, `/despesas`/`/pendencias` funcionando). Gate 4 (`po`) PASS,
13/13 critérios. Sem migration.

## Dívidas nomeadas

- Ticket futuro (não numerado): seletor de ano sincronizado entre
  dashboard e `/pendencias`, P1.
- `CONTAI-041` precisa decidir o destino definitivo do painel "Notas
  hábeis sem pagamento" — hoje mantido no dashboard por proveniência de
  comentário de código, não decisão formal (o `po` já registrou a
  ressalva de processo, não é dívida de produto).
- `(captura)` hospeda hoje telas de detalhe/gestão (`/documento/[id]`,
  `/pagamento/[id]`, etc.), não só captura de verdade — nome do grupo
  ficou impreciso de propósito (aceito pelo `cto-obra`; um terceiro grupo
  teria layout idêntico, churn sem ganho). Fica certo sozinho quando a
  primeira tela de detalhe migrar para o shell.
- Fetch duplicado da obra em `/obras` (já fazia sua própria consulta,
  agora o provedor do shell também carrega) — dívida de performance,
  some quando `/obras` for reescrita para consumir o provedor.
