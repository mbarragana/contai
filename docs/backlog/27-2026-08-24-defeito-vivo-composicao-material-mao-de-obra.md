## Defeito vivo em `composicaoDaDiscriminacao` — 2026-08-24 — achado ao construir o CONTAI-036

Origem: o `lead-engineer`, implementando o Bloco A do primeiro relatório
anual (`CONTAI-036`), precisou de uma regra de composição material × mão de
obra **por ano**. A que já existia — `composicaoDaDiscriminacao`, usada pela
tela de correção do `CONTAI-021`, **já em produção** — não tinha recorte de
ano e, mais grave, **pondera por documento individual numa ordem que o
próprio código declara sem efeito fiscal**.

### O defeito, tal como o `contador` nomeou

`docs/pareceres/2026-08-24-composicao-material-mao-de-obra.md`, §0:

> Quando um componente tem **mais de um documento hábil**, a repartição do
> valor coberto **entre eles** vem de `alocarCusto`, que a declara
> explicitamente *"sem efeito fiscal nenhum — ordem estável por `id` só para a
> tela não dançar"*. No **agregado** a soma está certa; a linha de **um
> documento individual**, nesse caso, é **arbitrária-mas-estável**.

Ou seja: o total do componente (material, ou mão de obra) sempre bate. O que
pode estar errado é **qual documento** carrega qual pedaço, quando o mesmo
componente tem mais de uma nota — e essa atribuição depende da ordem de `id`
no banco, não de nenhum critério fiscal.

### Por que não foi corrigido no `CONTAI-036`

**Corrigir mudaria o número de uma tela já entregue** (a correção de
documento do `CONTAI-021`). Isso é decisão de escopo do `po`/Mateus, não do
ticket que só precisava de uma regra **nova**, com recorte de ano, para o
relatório anual.

**A solução, por enquanto**: as duas funções convivem lado a lado em
`lib/fiscal/revisao.ts`, cada uma comentada, cada uma com a nota do parecer:

- `composicaoDaDiscriminacao` — a antiga, sem recorte de ano, **defeito vivo
  nomeado** no código, não corrigida
- `composicaoDoAno` — a nova (parecer §1), com recorte de ano, ponderada pelo
  **valor integral** dos documentos hábeis. É a que a discriminação anual usa

### D55 — a dívida

**Corrigir `composicaoDaDiscriminacao` para usar a mesma regra proporcional
de `composicaoDoAno`** — decisão do `po`, porque muda número numa tela em
produção (`CONTAI-021`). Enquanto não corrigida, a linha individual de
documento na tela de correção continua arbitrária-mas-estável; o agregado
está certo.

**Prioridade sugerida**: P2 — o erro não move o total declarado, só a
atribuição visual entre notas do mesmo componente. Não é urgente, mas é
dívida fiscal real, não cosmética, e fica registrada para não ser
redescoberta.
