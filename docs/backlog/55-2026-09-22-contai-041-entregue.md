# CONTAI-041 entregue — 2026-09-22 — tabela de despesas fecha a rodada "desktop shell"

Terceiro e último ticket da sequência iniciada pela rejeição do CONTAI-039
(`docs/backlog/44-.../CONTAI-039`), completando a resposta ao pedido
literal do Mateus: "despesas em formato de tabela". `/despesas` deixa de
ser stub e vira a primeira tela do produto que projeta `Documento` e
`Pagamento` linha a linha, comprovado ou pendente, na mesma tabela.

O núcleo técnico: `ResumoObra.despesas` é agregado por COMPONENTE (cluster
de NFs+PIX), não por pagamento — a tabela precisava de uma projeção pura
nova, `lib/fiscal/despesas.ts` (`linhasDeDespesa`), que decompõe
`alocacao` de volta em 1 linha por pagamento + 1 por documento órfão de
pagamento. Pendência nunca cria linha própria: vira anotação
(`situacoes[]`) na linha do registro a que já pertence, com a
`Consequencia` completa, nunca truncada. `retencao_sem_recolhedor` e
`nf_servico_sem_cno` entram como anotação dentro da linha do documento.
Terreno fica fora (tem rota própria).

**Garantia central, provada e não só afirmada**: nenhum centavo é contado
duas vezes entre linhas — 8 cenários de teste dedicados (NF+PIX 1:1, N:1,
1:N, componente parcial, agregado por favorecido) confirmam Σ das linhas
= Σ dos pagamentos + Σ dos documentos órfãos, e Σ comprovado das linhas =
Σ `custoComprovadoCentavos` dos componentes. `contador` conferiu a lógica
com os próprios olhos no Gate 2 e aprovou de primeira.

Gate 2 do `cto-obra` achou um bug real: documento sem valor lançado
(`documento.valor` nullable) virava `valorCentavos: 0` e a tela mostrava
"R$ 0,00" — uma afirmação de zero onde não havia dado, contra a doutrina
"campo vazio pergunta" e divergindo do detalhe (`/documento/[id]`), que já
mostra "—" para o mesmo caso. Corrigido: `valorCentavos: number | null`,
tela mostra `SEM_DADO`, ordenação manda linhas sem valor para o fim nas
duas direções.

Duas decisões de escopo, aceitas pelos dois revisores: o terceiro estado
(nota sem pagamento, nem comprovado nem em risco) ganhou chip cinza
NEUTRO fora do componente `Chip` (que só aceita `red`/`amb`/`grn` —
correto não estender o tipo para um estado que não é gravidade); a
anotação "Nota sem arquivo" (constantes do CONTAI-033) entrou na tabela
mesmo fora da letra do critério 3, porque sem ela uma nota sem arquivo e
sem pagamento ficaria muda (mesma classe de D47).

Testado: 925 unitários (35 novos em `despesas.test.ts`) + 273 E2E +
validação manual extensa no browser (filtro padrão "Todas", consequência
sem corte, valor nulo mostrando "—", filtros/ordenação, "Ver todas" sem
filtro pré-aplicado). Gate 4 (`po`) PASS, 11/11 critérios. Sem migration.

## Fecha a rodada "desktop shell"

Com este ticket, toda a iniciativa aberta pela rejeição do CONTAI-039 está
completa: `042` (18 famílias de pendência unificadas) → `040` (shell +
dashboard) → `043`/`044`/`045`/`046` (todas as telas de detalhe migradas
para o shell) → `041` (tabela de despesas). Nenhuma tela de gestão
continua na casca mobile de 430px; `(captura)` hospeda só `/adicionar/*`
e as telas de detalhe ainda não migradas por decisão explícita (`/entrar`,
`/conta`, `/obras/nova`).

## Dívidas nomeadas

- Nenhuma nova. As dívidas da rodada inteira estão listadas nas entradas
  40-54; nenhuma bloqueia produção.
