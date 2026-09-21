# Gate Fiscal do CONTAI-042 — a fila única das 18 famílias de pendência

**Data**: 2026-09-21
**Agente**: `contador`
**Pedido por**: `lead-engineer`, no Gate 1 do `/develop`, ANTES de escrever
código — o `CONTAI-042` classifica este gate como **obrigatório e bloqueante**,
não como o sanity check automático do resto da rodada.
**Veredito**: **LIBERADO COM 3 CONDIÇÕES BLOQUEANTES.**

> Transcrição do parecer. Regra fiscal que só existe no transcript da sessão é
> a mesma falha que a regra proíbe, com outro nome (`CLAUDE.md`).

---

## 0) A premissa do ticket que estava errada

O `CONTAI-042` (e a pergunta do `lead-engineer`) partia de *"a cor continua
vindo só de `gravidadeDaRegua`"*. **É falso hoje**, e é daí que sai a maior
parte deste parecer. Contagem por procedência da cor, na véspera do ticket:

| Cor vem de `gravidadeDaRegua` (tipo branded) — **10** | Cor é LITERAL em JSX — **8** |
|---|---|
| as 7 de `ResumoObra.pendencias[]` | `PendenciaCno` (red, `app/_components/obra.tsx`) |
| `pendenciasDeCorrecao` (`GRAVIDADE_CORRECAO_ANO_ANTERIOR`) | `vinculosCruzandoObras` (red, `app/page.tsx`) |
| `emitenteErrado` (`sinalDoEmitenteErrado` → `sinal.gravidade`) | `terrenoPagoSemComprovante` (red, componente) |
| `financiamentoFaltaLancar` (`f.gravidade`) | `documentosSemArquivo` (red, componente) |
| | `terrenoSemData` (red), `terrenoMaisDeUmaData` (red) |
| | `terrenoSemRegistro` (**amb**), `financiamentoAguardandoInforme` (**amb**) |

10 + 8 = 18 — **a procedência da cor fecha a mesma contagem da lista de
famílias**, por um caminho independente. Duas contagens independentes fechando
no mesmo número é o que eu aceito como "lista fechada"; a enumeração sozinha eu
não aceitaria.

---

## 1) A lista fechada — as 18 confirmadas, e a 18ª é `terrenoSemRegistro`

`[Certain]` **`ResumoObra.terrenoSemRegistro` é família legítima, e é a 18ª.**
Tem obrigação aberta (registrar os desembolsos do terreno), consequência fiscal
declarada (`TERRENO_ZERO_NAO_E_NADA_PAGO` — *"esta linha subestima a situação em
31/12 e não serve para a declaração"*), ação com `href`, e baixa por fato do
mundo. A direção do erro é a irreversível: custo subestimado = ganho de capital
inflado. Até este ticket ela só existia como `Consequencia` âmbar **dentro** do
card de custo confirmado da home — D47 com outro nome.

**A lista, fechada:**

As 7 de `ResumoObra.pendencias[]` — `quarentena`, `boleto_sem_nf`,
`pago_sem_nota`, `diferenca_sem_explicacao`, `pago_sem_comprovante`,
`retencao_sem_recolhedor`, `nf_servico_sem_cno`.

As 11 de fora — `cno`, `correcao_ano_anterior` (persistente),
`emitente_errado` (persistente), `vinculo_cruzando_obras`,
`terreno_pago_sem_comprovante`, `documentos_sem_arquivo`, `terreno_sem_data`,
`terreno_mais_de_uma_data`, `financiamento_falta_lancar`,
`financiamento_aguardando_informe`, **`terreno_sem_registro`**.

### 1.1 O `grep` só em `app/page.tsx` é insuficiente — busca estendida

`[Certain]` Restringir a busca à home é o próprio defeito que o ticket combate:
uma família que **nunca** apareceu na home é invisível para esse `grep`, e é
justamente a que está pior. Varridas as outras 39 rotas. Dois candidatos reais,
**ambos excluídos, com motivo**:

- **`notasEmitidasSemCno`** (`lib/fiscal/obra.ts`, tela
  `/obras/[id]/notas-sem-cno`) — **não é 19ª família**: é o **mesmo fato
  fiscal** de `nf_servico_sem_cno` (nota de serviço que não abate a aferição),
  com a **mesma consequência** e o **mesmo remédio** (retificação/reemissão pelo
  prestador), detectado por outro predicado. Listar as duas é contagem dupla do
  mesmo documento com o mesmo texto.
  ⚠️ **Dívida aberta aqui**: os dois predicados discordam sobre a mesma nota (um
  olha janela + `dataEmissao`, o outro `notaTrazCno === false`). Dois detectores
  do mesmo fato divergem no dia em que só um for atualizado — é D46. Auditoria
  própria, **fora deste ticket**.
- **Fatura de cartão** (`lib/fiscal/fatura.ts`) — `saldoNaoAlocadoCentavos` é
  valor **transitório da seleção em tela**, não estado gravado; o resíduo real
  persiste como compromisso aberto, que já tem superfície. Sem família nova.

`[Certain]` Verificados também `identificacao.ts` (só validadores),
`afericao.ts` e `risco.ts` (agregados — ver §2). Nada mais.

---

## 2) As exclusões — todas confirmadas

- **`notasSemPagamento`** — `[Certain]` fora. Terceiro estado neutro, §5.2 do
  parecer de referência: nota hábil não paga não é dispêndio nenhum, e somá-la
  inflaria a exposição.
- **`despesas`** — `[Certain]` fora. É o oposto de pendência.
- **`EXPLICACAO_CUSTO_ZERO`** — `[Certain]` fora. Explicação de um número, sem
  obrigação nem baixa próprias.
- **`custoEmRiscoIr` / `exposicaoInssBaseCentavos`** — `[Certain]` fora. São
  **agregados das famílias que a página já lista**; entrariam contando cada
  dispêndio duas vezes.
- **`terrenoForaDoAcumuladoCentavos`** — `[Certain]` fora, e a leitura do
  `lead-engineer` está certa: é o **mesmo fato** de
  `terrenoPagoSemComprovante`, visto do lado do acumulado — relação de
  subconjunto (a parte **datada** até 31/12 do ano em tela), mesma consequência,
  mesmo remédio. Listá-lo é contagem dupla.
- **`AvisoEquiparacao`** — `[Certain]` fora **da fila** (não tem obrigação, não
  tem baixa, não tem ação). **Mas eu exijo que ele apareça na página**, como
  banner fora da lista e fora da contagem, reusando `<AvisoEquiparacao />` com a
  guarda que já existe. Esta é a página que se lê *"antes de fechar a
  declaração"*, e o aviso diz que **os relatórios deste app podem não se aplicar
  à situação dele**. É a ressalva mais cara do produto.

### 2.1 Compromisso vencido sem resposta — NÃO é a 19ª família

`[Certain]` **Fica fora da fila.** Nada saiu da conta; previsão não decide nada
fiscal (parecer `2026-08-18-compromisso-versus-pagamento.md`, §7 e ADENDO §A).

O argumento *"ele veta as três saídas anuais, logo é pendência"* prova coisa
diferente do que parece: **veto e pendência são objetos distintos**.
`documentosSemArquivo` é as duas coisas ao mesmo tempo; compromisso vencido é só
veto — e ele **já tem superfície própria** (`BlocoAgendados` + `/compromisso`),
então não há D47 aqui. Fora, **sem** banner obrigatório.

`[Likely]` **Recomendação não bloqueante**: uma linha de status no topo, lendo
`podeGerarRelatorioAnual`, dizendo se as três saídas anuais estão liberadas e,
se não, qual dos vetos está fechado. Vira dívida se não couber.

---

## 3) Contagem dupla entre persistente e derivada

### 3.1 São disjuntas — confirmado
`[Certain]` Persistente = linha **gravada** em `pendencia_persistente`, cujo
objeto é **um ato de correção já praticado** ou **uma marcação feita pelo
Mateus**. Derivada = recalculada de `calcularResumo` a cada carga, sobre o
**estado atual** do acervo. Nenhuma derivada tem por objeto um ato passado;
nenhuma persistente tem por objeto o estado atual de um documento.

### 3.2 O mesmo documento em duas linhas é CORRETO
`[Certain]` Quarentena + "CNPJ errado" no mesmo documento devem aparecer nas
duas linhas: **remédios diferentes** (a nota refeita no CPF × conferir o papel e
corrigir o apontamento). Mesmo precedente de 2026-09-19 para
`documentosSemArquivo` + quarentena.

**A regra geral, para aplicar às 18 sem me reperguntar:** duas linhas são
legítimas quando os **remédios** são diferentes; são contagem dupla quando o
remédio é o mesmo. Foi por essa régua que caíram `terrenoForaDoAcumulado` (§2) e
`notasEmitidasSemCno` (§1.1), e que ficou de pé quarentena + sem-arquivo.

### 3.3 A única coexistência que precisa de texto
`[Certain]` `terrenoSemRegistro` pode coexistir com `terrenoPagoSemComprovante`
(obra só com desembolsos **sem data** e sem comprovante). Não é contagem dupla —
são afirmações diferentes —, mas parecem contraditórias lado a lado. O texto que
desfaz já é o da própria família: *"R$ 0,00 aqui significa que nada foi
registrado ainda — não que nada foi pago"*. **Não corte esse texto.**

### 3.4 ⚠️ BLOQUEANTE — o escopo de obra diverge

`[Certain]` `/pendencias` era de **todas as obras**; a home é **da obra ativa**;
e as 16 derivadas **só existem por obra**. Unificar sem decidir isso dá um dos
dois defeitos:

1. Escopar tudo na obra ativa → **as persistentes das OUTRAS obras perdem a
   única superfície que têm**, justo a família com prazo de retificadora
   correndo. **Inadmissível.**
2. Deixar como está → a página mistura os dois escopos **sem dizer**, e a
   contagem passa a significar duas coisas ao mesmo tempo.

**Adjudicação** `[Certain]`: **nenhuma pendência pode perder superfície neste
ticket.** As persistentes continuam de **todas as obras**, nomeadas por obra; as
derivadas são **da obra aberta**; e **a página declara os dois escopos em
texto**, em vez de deixar o leitor inferir. Contar itens de obras diferentes
**não é somar valor entre obras** — a proibição é sobre dinheiro, e esta página
não soma dinheiro nenhum. A **forma** (seção por escopo? rótulo por linha?) é
chamada de produto/arquitetura; a regra fiscal é essa e é inegociável.

---

## 4) A ordenação única

### (a) Os três grupos
`[Certain]` Vermelho → âmbar → informativo, com o informativo **nunca omitido**
e sem cor de régua. E a trava que falta no critério 2 do ticket: **nenhum grupo
pode ser truncado, paginado, colapsado ou limitado por teto** — nem com "ver
todos (N)". A régua de cor só governa risco se a lista inteira estiver visível.
Se o grupo vermelho tiver 40 linhas, aparecem as 40.

### (b) A ordem secundária dentro da cor
`[Certain]` **Dada a trava de (a), a ordem dentro de uma mesma cor não tem
consequência fiscal** — nada fica escondido por estar embaixo. É decisão de
legibilidade, e a ordem que a home já pratica é a única defensável num ticket
que promete "puro reposicionamento".

**Exigência de forma** `[Certain]`: a ordem tem de ser **lista declarada
explicitamente** dentro de `pendencias-unificadas.ts`, nunca efeito colateral da
ordem do JSX. Ordem emergente diverge da fila no dia em que alguém reordena a
tela — foi assim que a régua de cor discordou de si mesma por dois meses.

### `PendenciaCno` abre a lista — SIM, sempre
`[Certain]` Primeira do grupo vermelho, e **a razão tem de ficar escrita no
código** para ninguém reordenar por estética depois:

1. **Prazo legal correndo contra terceiro** — 30 dias do início da obra, Lei
   8.212/91 art. 49, II (`2026-08-09-obra-sem-cno.md`). Única família cujo
   relógio não é do app.
2. **O dano acumula por nota e é irreversível na parte já emitida** — *"o dano à
   aferição não começa no dia 31: nota de serviço emitida no dia 3 sem CNO já
   não abate"*. A alavanca de conserto morre com o último pagamento à
   empreiteira.
3. **É a única pendência do app que impede a VENDA** —
   `CONSEQUENCIA_SEM_CNO_AVERBACAO`: *"sem averbação o banco do comprador não
   financia e o cartório não lavra"*.

### Persistentes de ano anterior antes das derivadas vermelhas do ano corrente
`[Certain]` A correção de ano anterior significa que **uma DAA possivelmente já
entregue não corresponde mais ao acervo** — há afirmação errada de pé perante a
Receita, e o remédio depende de terceiro (retificadora com CRC) e de prazo
externo. A derivada do ano corrente ainda é corrigível **antes de qualquer
declaração existir**.

### Ressalva registrada como dívida
`[Likely]` `financiamentoFaltaLancar` fica por último no grupo vermelho, mas o
objeto dele é um **ano já fechado** cuja DAA pode já ter sido entregue —
irreversibilidade da mesma classe da retificadora. **Não mudar neste ticket**
(seria doutrina nova). Dívida: *"ordenação de `financiamentoFaltaLancar` de ano
≤ corrente−2 junto ao bloco de ano anterior"*.

### (c) A página não soma valor nenhum
`[Certain]` Nenhum total, nenhum subtotal, nem por grupo — lição do
`emPendenciaCentavos` morto no CONTAI-005. O valor **por linha** continua onde já
aparece hoje (é dado da linha, não soma); onde hoje não aparece
(`vinculosCruzandoObras`, `financiamentoFaltaLancar`) **não passa a aparecer**.

---

## 5) Condição de abertura e fechamento — nada muda ao migrar de tela

`[Certain]`

- **`PendenciaCno`**: aberta enquanto `obra.cno` for vazio. Não tem baixa, não
  tem "ok, entendi", **não expira com o prazo** — o prazo governa só a multa,
  que é a menor das três consequências, e muda o **texto**, nunca a existência.
- **As persistentes**: saem **só por desfecho escolhido**; a baixa é **por
  acréscimo — não apaga, não edita**; o histórico continua visível.
- **As derivadas**: somem sozinhas quando o fato muda. Sem dispensar, sem adiar,
  sem esconder, em nenhuma das 16.

**Precisão 1 — bloqueante de implementação** `[Certain]`: três famílias dependem
do `ano` (`terrenoSemRegistro`, `financiamentoFaltaLancar`,
`financiamentoAguardandoInforme`). A função unificada recebe **o mesmo `ano` que
a home usa** — `Number(hojeIso().slice(0,4))`. Outro ano muda a condição de
abertura dessas três. Seletor de ano na página volta a este gate.

**Precisão 2** `[Certain]`: `terrenoSemRegistro` abre quando
`terrenoNoAcumuladoCentavos === 0` **e** `semComprovanteCentavos === 0`. **Não
reimplemente esse predicado**: leia o campo do `ResumoObra`. Predicado fiscal
reimplementado é D46.

---

## 6) Texto de consequência — cópia literal, zero frase nova

`[Certain]` Inclusive para `PendenciaCno` e `terrenoSemRegistro`, que o `po` não
tinha mapeado.

**Instrução que fecha o furo real** `[Certain]`: onde a família **já tem
componente dedicado**, a fila **renderiza o mesmo componente** —
`CardDocumentosSemArquivo`, `CardPagoSemComprovante`, `PendenciaCno`,
`PendenciaDeDatas`. Motivo concreto: o **plural** de `documentosSemArquivo` e a
linha do veto das saídas anuais são **inline no componente**, sem constante.
Reescrevê-los na fila cria a segunda cópia do mesmo texto fiscal — D46 no ato.

**Dois textos que não podem ser reduzidos** `[Certain]`:

- **`PendenciaCno` tem QUATRO partes e elas andam juntas**: a frase do prazo, as
  duas consequências (`_NOTAS` + `_AVERBACAO`), o bloco *"O que não muda"*
  (`CNO_NAO_MUDA_IRPF`) e o próximo passo. Cortar o "o que não muda" faz o
  Mateus parar de registrar nota no CPF achando que sem CNO não adianta — e aí
  ele perde **custo de aquisição** por causa de um problema de **INSS**. É a
  mistura das duas apurações acontecendo na cabeça do usuário.
- **`emitenteErrado`**: o `avisoAnoAnterior` **não carrega a cor da pendência** —
  fica âmbar mesmo no card vermelho.

---

## 7) A contagem de abertas

### 7.1 O que entra
`[Certain]` **Vermelhas + âmbares. `financiamentoAguardandoInforme` FORA** — é
aviso informativo, o calendário do banco, sem obrigação aberta nem ação possível
hoje. Badge que não zera com trabalho vira ruído, e ruído fabrica cegueira ao
aviso.

`[Certain]` A contagem é de **LINHAS renderizadas nos grupos vermelho e âmbar**:
os agregados contam **1**, como a linha que são. Nada renderizado nesses grupos
fica fora da contagem, e nada contado deixa de estar visível.

### 7.2 ⚠️ BLOQUEANTE — o estado vazio
`[Certain]` **Com a contagem em zero, a página NÃO pode dizer "Nenhuma
pendência"** enquanto houver informativo, veto de saída anual fechado ou aviso
de equiparação de pé. Dizer isso é reencenar a **D59** na tela que existe para
matá-la, e desta vez na superfície que se lê antes de declarar. O estado vazio
afirma **o que foi verificado e em que escopo**, nunca "está tudo certo".

---

## 8) ⚠️ BLOQUEANTE — as 8 famílias de cor literal NÃO passam pela régua

`[Certain]` Declarar `dinheiroSaiu`/`apoioHabilNoAnoCerto` para elas **não é
portar cor, é fabricar fato fiscal** para a fila ordenar bonito — regra de cor
nova com roupa de tipo, que o Fora de Escopo do ticket proíbe.

**(A) `PendenciaCno` — não recebe `Gravidade` nenhuma.** A régua mede o eixo do
**custo de aquisição** (*"o acervo sustenta **o valor** no ano certo?"*). Esta
pendência não tem valor, não tem dispêndio e, por `CNO_NAO_MUDA_IRPF`, **não
toca o IRPF**: é obrigação acessória **previdenciária**. Passá-la pela régua
mistura as duas apurações — o invariante central do `CLAUDE.md` — e devolveria
âmbar como **artefato do branch default**, não como adjudicação. O vermelho dela
está fundamentado nos três pontos do §4.

**(B) `documentosSemArquivo` — vermelho FIXO, com fundamento que não é o
dinheiro.** Recusar `dinheiroSaiu: true` fixo está certo: o predicado
(`arquivo_path IS NULL`) não apura pagamento. O vermelho de 19/09 se funda em
*"o arquivo que falta **É** o documento hábil"*, e a prova está no código —
`podeGerarRelatorioAnual` veta **as três** saídas anuais por documento sem
arquivo **sem olhar pagamento**. Cor por item (variável) fica **rejeitada**:
seria regra nova, e rebaixaria a âmbar justamente o caso em que a nota pode nem
ter sido paga.

**A forma exigida para as 8** `[Certain]`: a cor migra **por referência, não por
reconstrução**. Cada uma vira constante exportada nomeada no módulo que já é
dono dos textos da família (`obra.ts`, `terreno.ts`, `documento.ts`,
`vinculo.ts`), tipada `"red" | "amb"` — **não** `Gravidade` —, e **a tela de hoje
passa a ler a mesma constante**. Resultado: uma definição só onde havia literal
solto, e sem furar o verificador (a marca branded existe para impedir **pendência
nova** de chutar cor; portar pendência existente não é chutar). A fila ordena
por um `bloco: "vermelho" | "ambar" | "informativo"` declarado por família: as 10
derivam do `Gravidade` que já têm, as 8 do valor portado.

---

## 9) Automático × humano

`[Certain]` **Automático**: enumerar as 18, agrupar por cor, ordenar, contar,
exibir consequência copiada.

`[Certain]` **Exige contador humano (CRC), e a página não pode sugerir o
contrário**: retificar ou não a DAA de ano anterior (preservar a frase inteira
de `AVISO_ANO_ANTERIOR`); tratamento de diferença de valor por encargo; e a
hipótese de **equiparação a PJ**. A página **informa e organiza; não assina
declaração** — e não pode ter texto do tipo "tudo pronto para declarar".

---

## 10) Checklist que travava o Gate 1

1. Escopo de obra conforme §3.4 — nenhuma persistente de outra obra some, e os
   dois escopos são ditos em tela.
2. As 8 famílias de cor literal não passam pela régua; cor portada por constante
   nomeada, lida também pela tela de hoje (§8).
3. Estado vazio não afirma "Nenhuma pendência" (§7.2).
4. Ordem declarada explicitamente na função, `PendenciaCno` primeira do grupo
   vermelho, com a razão em comentário (§4).
5. Nenhum grupo truncado/paginado/colapsado (§4a).
6. Componentes dedicados reusados, não reescritos (§6).
7. `ano` da função = o da home (§5).
8. Banner de equiparação presente, fora da lista e da contagem (§2).
9. Zero soma de valor na página (§4c).

## Dívidas abertas por este parecer (não bloqueiam o CONTAI-042)

1. Auditoria dos dois predicados de "nota sem CNO" (§1.1).
2. Ordenação de `financiamentoFaltaLancar` de ano antigo (§4).
3. Linha de status do veto das saídas anuais (§2.1).
4. Garantir que o `AvisoEquiparacao` não perca superfície quando o `CONTAI-040`
   reduzir a home a um painel de 4 (§2).

## Fundamentos citados

`docs/pareceres/2026-08-09-obra-sem-cno.md` ·
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (§7 + ADENDO §A) ·
`docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md` (§4b) ·
`docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md` (ADENDO 1 §A.5,
§A.7.2; ADENDO 2 §A.4) ·
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO A.4) ·
`lib/fiscal/gravidade.ts`, `resumo.ts`, `obra.ts`, `terreno.ts`, `revisao.ts`,
`compromisso.ts` · `docs/backlog/46-2026-09-21-cinco-decisoes-desktop-shell-contai-040-042.md`
