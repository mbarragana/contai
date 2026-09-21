# CONTAI-035 Reconciliar a régua de cor (D39) com todo o app

## Tipo e Prioridade
bug — **P0** — a régua de cor é o sinal que decide se o Mateus para para agir
ou segue em frente; um vermelho pintado de âmbar esconde exatamente o caso
que a meta 1 do produto existe para prevenir.

## Dor de Origem
`docs/backlog/25-2026-08-23-a-regua-de-cor-e-o-que-ela-escondia.md`: *"seis
pendências com o dinheiro fora do bolso pintadas de âmbar"*. A régua (D39)
existe desde 21/08 e nunca foi reconciliada com os call sites reais. Achado
mais concreto: o comentário em `app/page.tsx` (item B) **confessa** a razão
do vermelho ("o extrato existe, o dinheiro saiu, e o custo daquele ano não
existe no sistema") e a linha seguinte pinta `border-amb` — alguém escreveu
o argumento contra a própria cor e não percebeu.

## User Story
Como dono da obra revisando pendências em casa, sentado, quero que a cor de
cada pendência reflita fielmente se o dinheiro já saiu sem apoio hábil no ano
certo, para nunca deixar esperando — por confiar num âmbar errado — uma
pendência que já é fato consumado com consequência fiscal aberta.

## Critérios de Aceite

1. [x] **Gate de mock nível 3 em `design/mocks/CONTAI-035.md`** (tabela
       antes/depois, 25 linhas — 17 mudam + 8 conferidos) aprovada pelo
       Mateus. Sem tela nova, sem texto novo de vulto. Mock aprovado em
       2026-08-24.
2. [x] **Regra central**: nova função `gravidadeDaRegua(...)` em
       `lib/fiscal/gravidade.ts`, único produtor de um tipo `Gravidade`
       branded (`"red" | "amb"` com marca de tipo) — nenhuma pendência nova
       compila com cor literal chutada. D39 revisada:
       > saiu? → tem apoio hábil no ano certo? → não = vermelho
       > vermelho = fato consumado + consequência fiscal aberta e nada no
       > acervo sustenta o valor no lugar certo; âmbar = nada saiu ainda, ou
       > o valor já está sustentado e falta só corroboração.
       (`docs/backlog/25-2026-08-23-a-regua-de-cor-e-o-que-ela-escondia.md`)
3. [x] **Item B → vermelho** (2 sites): `app/page.tsx:569-575`,
       `app/obras/[id]/terreno/page.tsx:346-367`.
4. [x] **Item C → vermelho** (9 sites, não 5 como o inventário original
       dizia, nem 7 como a leitura de 24/08 corrigiu): `app/page.tsx:399-424`,
       `app/pendencias/page.tsx:162-184`, `app/pendencias/[id]/page.tsx:431`,
       `app/documento/[id]/corrigir/valor/page.tsx:213-221` e `:425-433`,
       `app/documento/[id]/obra/page.tsx:335-345` e `:612-615`,
       **`app/pagamento/[id]/obra/page.tsx:355` e `:632`** (2 sites
       acrescentados no Gate 2 de implementação, 2026-09-20 — a tela nasceu
       no `CONTAI-008`, depois do inventário de 23/08 que gerou este ticket;
       é gêmea literal de `documento/[id]/obra`, mesmo chip, mesmo
       `AVISO_ANO_ANTERIOR`, mesma constante `GRAVIDADE_CORRECAO_ANO_ANTERIOR`.
       Deixá-los âmbar reintroduziria a dor de origem dentro do próprio
       ticket que a fecha — `cto-obra` e `contador` confirmaram a extensão,
       técnica e fiscalmente). Os 9 mudam juntos no mesmo diff — divergir um
       deles reintroduz a dor de origem dentro do próprio ticket que a fecha.
5. [x] **Item D — vermelho se existir ≥1 pagamento vinculado ao documento
       (`pagamento_documento`), senão âmbar** (4 sites):
       `app/page.tsx:434-442`, `app/pendencias/page.tsx:194-200`,
       `app/pendencias/[id]/page.tsx:202`,
       `app/documento/[id]/cnpj-errado/page.tsx:232-235`.
       `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §4.4:
       o pagamento herda o favorecido errado no momento em que é ligado ao
       documento — a partir daí, o acervo já reflete o favorecido errado na
       ficha Pagamentos Efetuados. Não depende de valor nem de PF/PJ.
       `carregarPainelDePendencias` (`lib/data.ts:696`) e a página
       `cnpj-errado` não carregam vínculos hoje — precisam de select novo em
       `pagamento_documento`.
6. [x] **Item D — aviso condicional "exige CRC"**, quando o pagamento
       vinculado é de ano anterior ao corrente (heurística de calendário,
       mesma de `SO_SEI_QUE_E_ANO_ANTERIOR`), texto novo
       `AVISO_CNPJ_ERRADO_ANO_ANTERIOR` (ao lado de
       `EMITENTE_ERRADO_O_QUE_FALTA` em `lib/fiscal/revisao.ts`), esqueleto
       de `AVISO_ANO_ANTERIOR`: *"Este documento com CNPJ errado sustenta um
       pagamento de um ano anterior; se a DAA daquele ano já foi entregue,
       avalie retificadora com seu contador."* Renderiza como segunda
       `Consequencia cor="amb"` — o aviso não carrega a cor da pendência, só
       informa. **Confirmação de uma linha do contador antes do Gate 1**: o
       gatilho é mesmo a heurística de calendário, ou existe outro sinal?
7. [x] **Item E — vermelho se `naturezaAquisicaoTerreno === "financiado"`**
       (2 sites): `app/obras/[id]/terreno/page.tsx:307-321` — **achado do
       designer**: hoje é âmbar apesar de a branch já ser gated por essa
       condição (linha 306); vira vermelho, não é conferência. **Confirmação
       de uma linha antes do Gate 1**: é mudança real, ou existe outro site
       que a adjudicação original queria dizer? — e
       `app/obras/[id]/terreno/informe/[anoBase]/page.tsx:326-329`, que hoje
       checa o campo errado (`!financiamento`) e passa a checar
       `naturezaAquisicaoTerreno === "financiado"`.
8. [x] **Item A — conferência, sem mudança** (já vermelho, entregue no
        `CONTAI-025`): `app/page.tsx:524-530,551-557`,
        `app/obras/[id]/terreno/page.tsx:501`,
        `app/obras/[id]/terreno/desembolsos/page.tsx:428,672`.
9. [x] **Âmbar legítimo, sem mudança** (dinheiro não saiu): "sem pagamento
        ligado" (`lib/fiscal/resumo.ts:588`, fora da régua por construção —
        parecer §5.2), "boleto aguardando pagamento" (`resumo.ts:409-423`),
        "aguardando informe" (`terreno.ts`, `AGUARDANDO_INFORME`),
        "previsto — ainda não pago" (`terreno/page.tsx:531`), chip de
        agendado (`agendado.tsx:75,158,209,246`), "falta dizer como o
        terreno foi adquirido" (`terreno/page.tsx:253-255`). Inclui a NF de
        serviço sem retenção confirmada (`servico_sem_retencao`) — **essa
        pendência está sendo apagada, não recolorida** (ver Perguntas
        Abertas: item F saiu de escopo por conflito com o `CONTAI-038`).
10. [x] **Exceção nomeada, sem mudança**: "pago sem comprovante" PJ fica
        âmbar (`lib/fiscal/pagamento.ts:213-218`, `SEM_COMPROVANTE_PJ`);
        PF fica vermelho (`:220-225`, `SEM_COMPROVANTE_PF`) —
        `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
        §601-602. **Citação corrigida pelo designer**: o local real é
        `lib/fiscal/pagamento.ts`, não `pago-sem-comprovante.tsx` (esse
        componente é só do desembolso do terreno, sempre vermelho, sem ramo
        PJ).
11. [x] **D54 — teste-trava, não decorativo**: Vitest cobrindo
        `gravidadeDaRegua` por tabela-verdade + lista de exceções nomeadas
        (1 entrada hoje: `pj_pago_sem_comprovante`, união fechada de
        TypeScript, não string de rótulo — rename de rótulo não sai da
        malha) + fixtures dos produtores (resumo, terreno, revisao) provando
        que D vira vermelho quando há vínculo. O teste casa contra a
        FUNÇÃO, nunca contra texto de tela. **Item F saiu da tabela-verdade**
        (ver Perguntas Abertas) — a união de exceções fica pronta para
        receber uma segunda entrada (`retencao_sem_recolhedor`) quando o
        `CONTAI-038` entrar, sem precisar reabrir este ticket.

## Out of Scope
- Ordenação da lista de pendências por valor-fora-da-soma (proposta do `po`,
  registrada como aberta) — trabalho do `designer` em outro ticket.
- Terceiro nível de cor ("depende de terceiro / fecha sozinho") — rejeitado
  por mérito na origem do relato (é roteamento de ação, não consequência
  fiscal; refutado pelo próprio relato 005).
- Chip literal em JSX novo fora dos produtores tocados neste ticket —
  cobertura por review no Gate 2, não por compilador (dívida registrada).
- Pendências fora do inventário A-F que já usam cor correta hoje (CNO sem
  registro, documento hábil/inábil, identificação de NF, conferência de
  extrato, correção de emitente, aviso de preço contratado).
- Rodada 2 do item D (reavaliar cor por pagamento individualmente corrigido,
  não por documento inteiro) — depende de feature "repontar pagamento" que
  não existe.

## Gate Fiscal (Contador) — FECHADO
Base: D39 revisada. Exceção nomeada única hoje: "PJ pago sem comprovante"
(`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md:594-602`) —
fundada em distinção específica (NF já constitui o custo, falta só
corroboração bancária de fato pouco duvidoso). **D não reproduz essa
estrutura**: quando vermelho, é a regra geral se aplicando (fato consumado +
nada sustenta no lugar certo), não exceção nova.

**Item D**: vermelho não depende de valor, ano fechado/aberto, ou PF/PJ — só
de existir vínculo. "Ano fechado" muda a escalada (soma aviso "exige CRC"),
não a cor.

**Item F removido de escopo (2026-09-19)** — não é mais deste gate. O
parecer `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (corpo +
ADENDO) corrigiu a premissa fiscal em que o item F se apoiava: a pendência
`servico_sem_retencao` inteira está sendo apagada pelo `CONTAI-038`, não
recolorida por este ticket. Detalhe da decisão:
`docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`.

**Automático vs. humano**: cor é sempre automática (função pura). "Exige
CRC" é aviso condicional automático (texto), não decisão — a decisão de
retificar continua do Mateus com o contador dele.

## Pre-mortem
1. **A mesma falha do item B se repete em escala maior no item C** (7 sites,
   não 2) — se a correção acertar a home e esquecer lista/detalhe/documento,
   a régua volta a discordar de si mesma. Guarda: critério 4, todos os 7
   nomeados, nenhum "resto" implícito.
2. **O teste-trava vira decorativo se casar por texto do Chip** — rótulo
   reescrito no futuro sai da malha em silêncio. Guarda: critério 13, tipo
   branded + teste contra a função, nunca contra string de tela.
3. **D sem resposta a tempo do `/develop`** — se o Gate Fiscal não tivesse
   respondido antes da implementação, alguém assumiria a condição sem
   escrita do contador. Já fechado neste ticket (ver Gate Fiscal acima).

## Viabilidade (CTO)
**Complexidade: M. Não fatiar** — fatiar deixa metade do app vermelho e
metade âmbar no meio do caminho, a mesma inconsistência que o ticket existe
para matar, e o tipo branded exige tocar todos os produtores no mesmo diff.

**Sem migration.** A condição "≥1 pagamento vinculado" é computável com o
que existe (`pagamento_documento`, já viaja em `Pagamento.documentoIds`).
Lacuna real é de loader, não de schema: `carregarPainelDePendencias` e a
página `cnpj-errado` não carregam vínculos hoje — select novo em
`lib/data.ts`, volume trivial.

**`gravidadeDaRegua({dinheiroSaiu, apoioHabilNoAnoCerto}, excecao?)` →
`Gravidade`** (branded type), em `lib/fiscal/gravidade.ts` — único produtor.
`Pendencia.gravidade` e os shapes de terreno/revisao passam a exigir o
brand. Limite honesto: `Chip cor="amb"` literal em JSX novo ainda escapa do
brand — mitigado por review no Gate 2, não por compilador (dívida).

**Arquivos**: `lib/fiscal/gravidade.ts` (novo) + `.test.ts` ·
`lib/fiscal/resumo.ts` · `lib/fiscal/terreno.ts` · `lib/fiscal/revisao.ts` ·
`lib/data.ts` (select de vínculo nas 3 telas de pendência) ·
~10 arquivos de tela listados nos critérios 3-7.

**Dívidas criadas**: chip literal em JSX segue possível sem trava de
compilador; uma query a mais nas 3 telas de pendência (item D).

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: **`CONTAI-038`** (retenção variável em NF de serviço) depende de
  `lib/fiscal/gravidade.ts`/`gravidadeDaRegua` existindo — a pendência nova
  dele (`retencao_sem_recolhedor`) entra como segunda exceção nomeada na
  união que este ticket cria. `CONTAI-035` (sem item F) precisa ser
  implementado **antes** do `CONTAI-038` — decisão registrada em
  `docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`.

## Perguntas Abertas
- ~~**Item 6 (D, "exige CRC")**~~ — **RESPONDIDA no Gate 2 de implementação,
  2026-09-20.** O `contador` confirmou: a heurística de calendário
  (`SO_SEI_QUE_E_ANO_ANTERIOR`, ano do pagamento < ano corrente) é o gatilho
  correto — o app não sabe se a DAA daquele ano foi entregue, só que o
  vínculo cruza para um ano já fechado; vínculo do ano corrente não dispara
  porque a declaração daquele ano ainda não foi entregue.
- ~~**Item 7 (E, site 1)**~~ — **RESPONDIDA no Gate 2 de implementação,
  2026-09-20.** É mudança real (âmbar → vermelho), confirmada pelo
  `contador` e pelo `cto-obra`: `naturezaAquisicaoTerreno === "financiado"`
  é o único gatilho correto — só nessa natureza há financiamento correndo
  sem contrato cadastrado onde lançar o informe.
- ~~**Item F**~~ — **removido de escopo em 2026-09-19** (era pergunta sobre
  `false`/`null` tratados igual; ficou sem objeto porque a pendência inteira
  está sendo apagada pelo `CONTAI-038`, não recolorida por este ticket). Ver
  `docs/backlog/31-2026-09-19-sequenciamento-contai-035-038.md`.

## Cenário e checagem final
**Gestão** — todas as telas tocadas são consultadas em casa, sentado, ao
revisar o estado da obra; nenhuma é fluxo de captura. Teste do Canteiro não
se aplica.

**Veredito: APROVADO**, com 2 Perguntas Abertas para confirmação de uma
linha antes do Gate 1 (nenhuma bloqueia a aprovação do mock nível 3). Item F
saiu de escopo em 2026-09-19, sem reabrir Gate de Mock nem Gate Fiscal — é
remoção de escopo por premissa fiscal substituída, não mudança de
comportamento.
