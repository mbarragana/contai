# Parecer fiscal — retenção variável (3%, 4,8%) em NF de serviço PJ, `retencao11 boolean` não comporta o fato

- **Data**: 2026-09-18 · **Autor**: agente `contador`, execução read-only
- **Provocação**: Mateus registra que as notas do **Francisco** trazem retenção
  aparente de **3%** e as do **Alex**, de **4,8%** — nenhuma delas 11%, nenhuma
  0%. O schema, os tipos e a UI hoje modelam a retenção como
  `retencao11: boolean | null` (`app/adicionar/documento/page.tsx`,
  `lib/fiscal/resumo.ts`, `lib/fiscal/documento.ts`).
- **Consome**: `2026-08-18-nfse-empreitada-simples-nacional.md` — em especial o
  **A.1** (correção do invariante do `CLAUDE.md`: a retenção de 11% **não é a
  condição** que abate a aferição; nunca existe legitimamente quando o tomador é
  pessoa física) e o **§4.2** (achado de modelagem: `retencao_11 boolean` não
  aguenta nem o caso binário, muito menos um percentual livre).
- **Normativo para**: o campo de retenção no registro de documento; o motor de
  cálculo da aferição/SERO; o texto de aviso que acompanha o campo.

> Marcações `[Certain]` / `[Likely]` / `[Guessing]` seguem a convenção do
> projeto. Nada aqui substitui contador humano (CRC) na assinatura da
> declaração.

---

## 0. A resposta desconfortável primeiro

**A pergunta "por que não é 11%?" já nasce da premissa errada.** [Certain,
reafirmando o A.1 do parecer de 2026-08-18] Para um tomador **pessoa física**
como o Mateus, a retenção do art. 31 da Lei 8.212/91 **não existe em nenhum
percentual** — nem 11%, nem 3%, nem 4,8% — porque o dever de reter é da
**"empresa contratante"**, e ele não é empresa para esse efeito. A nota fiscal
real já examinada em 2026-08-18 confirmou isso na prática: INSS, IR, CSLL, PIS e
COFINS vieram **todos 0,00**, exatamente as retenções que dependem de tomador
PJ.

Logo, **Francisco e Alex mostrarem 3% e 4,8% não é "uma variação dentro do
esperado" — é uma quebra do padrão que a última nota real confirmou.** Antes de
desenhar campo, preciso saber **o que aquele percentual é**, e isso só está no
documento, não na minha inferência. Trato isso como as duas hipóteses
concorrentes abaixo, na ordem de probabilidade que atribuo, e devolvo perguntas
objetivas no §5.

---

## 1. É normal a retenção variar entre prestadores? Sim e não — depende do que está variando

**Se a pergunta é "pode existir retenção de INSS art. 31 de 3% e de 4,8% numa
NF de serviço de construção civil, legitimamente, entre PJs distintas" —
sim, em tese, mas só quando o tomador é PJ**, e por uma causa muito específica:
a retenção de 11% incide **sobre a base de mão de obra**, não sobre o valor
total da nota (Lei 8.212/91, art. 31, §2º c/c IN RFB 2.110/2022 — a base
exclui material comprovadamente fornecido e destacado, vale-transporte,
equipamento próprio etc.). Uma nota em que o material é 70% do valor pode
mostrar retenção "de fato" equivalente a ~3,3% do valor total, mesmo a alíquota
legal sendo 11% sobre a base de mão de obra. **Isso é aritmética legítima**
[Likely] — **mas pressupõe que existe obrigação de reter em primeiro lugar**, e
essa obrigação, no seu caso, **não existe** (§0). Não posso usar essa causa
para explicar as notas do Francisco e do Alex sem primeiro derrubar o §0.

**Se a pergunta é "existe uma retenção legítima e variável, diferente do art.
31, que apareça numa nota do Simples Nacional com tomador PF" — sim, e é a
hipótese mais provável aqui**: [Likely, confiança média-alta]

1. **Composição informativa do Simples Nacional (Anexo III ou IV), não
   retenção de fato.** O sistema de NFS-e do Simples costuma discriminar, na
   nota, o percentual de cada tributo dentro da alíquota efetiva do DAS
   daquela competência — inclusive uma linha rotulada "INSS" ou "CPP", que é a
   fatia da Contribuição Previdenciária Patronal **dentro da alíquota do
   Simples da empresa**, calculada pela **RBT12** (receita bruta dos últimos
   12 meses) dela. **Isso não é dinheiro descontado do que o Mateus paga** — é
   um demonstrativo de como o imposto da prestadora é composto. Já vi esse
   padrão de confusão: a nota examinada em 2026-08-18 trazia "4,6228%" que
   **parecia** retenção e **era** a alíquota efetiva de ISS do Simples, sem
   nenhum valor descontado do tomador. 3% e 4,8% são compatíveis com a fatia
   de CPP dos Anexos III/IV em faixas de receita diferentes entre Francisco e
   Alex [Guessing quanto aos números exatos — **as tabelas de partilha variam
   por Anexo e por faixa e eu não vou cravar percentual de memória**].
2. **Confusão de rótulo do prestador/contabilidade dele**, aplicando lógica de
   retenção PJ-PJ (art. 31) a uma nota emitida para PF, por erro de sistema de
   emissão (o campo "reter INSS?" do software de NFS-e às vezes vem marcado
   por padrão conforme o código de serviço, sem checar quem é o tomador).
   [Guessing]
3. **É de fato ISS retido, com outro rótulo na captura do Mateus** — o mesmo
   padrão do caso de 2026-08-18, só que agora à paisana de "retenção de INSS"
   porque foi ele (ou o app) quem nomeou o campo, não a nota. [Guessing]
4. **Retenção genuinamente indevida, calculada e descontada de fato** — o
   prestador desconta 3%/4,8% do que paga a ele mesmo (⚠️ inversão: aqui é o
   prestador que recebe menos do Mateus, então "descontar" significa o
   prestador cobrar menos e reter a diferença para si próprio, alegando que vai
   recolher). Se for isso, **o valor líquido pago é menor que o bruto da nota
   sem lastro legal**, e nasce exatamente o mesmo problema do §5 do parecer de
   2026-08-18 (ISSRF do tomador PF): alguém fica devendo, e não se sabe quem.
   [Guessing, mas é o cenário que exige ação mais rápida se for verdadeiro]

**Não decido entre as quatro daqui.** [Certain quanto à recusa] A distinção
exige o **campo exato da nota** (nome do tributo, base de cálculo, se o valor
foi efetivamente subtraído do pagamento ou é só informativo) — dado que só o
documento e o Mateus têm.

---

## 2. Isso muda a base de aferição do SERO/CNO? — a premissa da pergunta já foi corrigida em 2026-08-18

**Não da forma como a pergunta pressupõe, e a correção é importante.** [Certain]

A formulação "o que entra na base é o valor da NF de serviço PJ menos material,
independente do percentual retido" já foi **superada pelo A.1** do parecer
anterior, não apenas por este caso. Reafirmando, porque é o ponto mais caro do
parecer inteiro:

> **A base de aferição não é reduzida pelo valor da nota, nem pelo valor
> retido, nem pelo percentual de retenção.** É reduzida **apenas** pela
> **remuneração de mão de obra que a empresa prestadora declara e vincula ao
> CNO da obra** (eSocial com lotação tributária no CNO + EFD-Reinf/DCTFWeb).
> Isso é um evento **declaratório**, feito pela prestadora, em canal totalmente
> separado da nota fiscal.

Consequência direta para o caso concreto: **tanto faz Francisco mostrar 3%,
Alex mostrar 4,8%, ou qualquer nota mostrar 11% ou 0%** — nenhum desses
percentuais, por si só, abate um real da aferição do CNO. O que abate é a
resposta à **Pergunta 2** do adendo A.5 do parecer anterior: *"esta mão de obra
foi declarada no meu CNO?"* — Sim (com comprovante do eSocial/EFD-Reinf
anexado) · Não · Ainda não sei.

**O que o percentual da nota FAZ importar, e é secundário**: se alguma fração
foi de fato **descontada do pagamento** (subtraída do que o Mateus efetivamente
transferiu), isso tem efeito no **custo de aquisição** (§3) e pode indicar uma
obrigação de recolhimento em aberto (cenário 4 do §1) — nunca efeito na
aferição do CNO.

**Reforço explícito, porque o produto ainda pode ler a pergunta original do
Mateus como validada**: não crie lógica alguma em `lib/fiscal/resumo.ts` que
subtraia "valor da nota × (1 − percentual retido)" da base do SERO. Essa conta
**não existe** na legislação previdenciária para aferição indireta de obra.
Se `lib/fiscal/resumo.ts` já faz algo parecido com isso hoje (a pergunta do
Mateus sugere que o mental model do produto é esse), **é o achado mais grave
deste parecer** e teria prioridade sobre o resto.

---

## 3. O que o produto deve registrar por documento

**Rejeito as duas opções binárias da pergunta (percentual livre "puro" vs.
percentual vinculado ao cadastro do prestador) e recomendo uma terceira
estrutura**, pelas razões abaixo.

### Por que não "percentual vinculado ao prestador com % padrão"

1. **A alíquota efetiva do Simples muda com a RBT12 da empresa, mês a mês** —
   não é atributo fixo do prestador, é atributo da **competência**. Um Alex
   que fatura mais este ano muda de faixa e o "%" cadastrado vira mentira
   silenciosa.
2. Viola a regra dura já registrada duas vezes no projeto (adendo de
   2026-08-10, e reforçada no §7.4 de 2026-08-18): **campo fiscal não tem
   default.** Um "% padrão do prestador" é exatamente um default disfarçado de
   cadastro — a segunda nota de Alex herdaria 4,8% sem ninguém olhar a nota.
3. Colapsaria as quatro hipóteses do §1 numa só: se o app já "sabe" que Alex é
   4,8%, ninguém vai perguntar de novo se aquele número é CPP informativo, ISS
   com rótulo trocado, ou retenção indevida.

### Por que não "percentual livre digitado", sozinho

Um número solto sem saber **o que ele representa** e **sobre qual base incide**
é dado inútil para as duas apurações — não dá para saber se abate custo, se
gera pendência de recolhimento, ou se é só um informativo do DAS que não
precisa de ação nenhuma.

### O que registrar, por documento (`nf_servico`) — estrutura recomendada

Já estava prescrito no §4.1(5) do parecer de 2026-08-18 ("capturar as
retenções uma a uma, mesmo zeradas — ISS, INSS, IR, CSLL, PIS, COFINS + valor
líquido"); este caso só mostra por que **é urgente parar de adiar**:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `valor_bruto_nota` | numérico | sim | nenhum |
| `valor_liquido_recebido_pelo_prestador` (= o que efetivamente sai da conta do Mateus para o prestador) | numérico | sim | nenhum |
| Para cada tributo que a nota discriminar (INSS/CPP, ISS, IRRF, PIS, COFINS, CSLL) | `{ percentual: number \| null, valor: number \| null, e_desconto_efetivo: boolean \| null }` | sim capturar a linha se a nota tiver; `null` explícito se a nota não discriminar | nenhum |
| `natureza_do_percentual_inss` | enum livre de digitação: `"retencao_art31"` · `"cpp_informativo_simples"` · `"nao_identificado"` — **escolhido pelo Mateus**, nunca inferido | sim, sempre que houver linha de "INSS" na nota | **`"nao_identificado"` no nascimento, nunca outro valor** |

**Regra que evita o erro dos dois lados**:
- `e_desconto_efetivo = true` → esse valor **precisa aparecer como perna de
  pagamento** vinculada ao mesmo documento (mesmo mecanismo do fechamento
  `Σ pagamentos == valor_bruto_nota` já normatizado em 2026-08-18 §4.1). Se
  ninguém sabe pra onde foi esse dinheiro (recolhido por quem, guia de quê),
  a nota fica **parcialmente paga**, igual ao caso do ISS.
- `e_desconto_efetivo = false` (informativo/DAS) → não gera pendência de
  pagamento nenhuma; é só dado guardado para a discriminação e para uma
  eventual pergunta futura do fisco.
- **A aferição do SERO nunca lê nenhum desses campos.** Ela só lê a resposta à
  Pergunta 2 do A.5 (declarado no CNO: sim/não/ainda não sei) — que é campo
  **por nota**, independente de quanto foi retido ou não.

**`documento.retencao11: boolean` deve ser removido**, não só de UI — do
schema. Ele responde uma pergunta ("é 11%?") que **nunca é a pergunta certa**
para tomador PF (§0), e mantê-lo como campo morto no schema é convite para
algum cálculo futuro (ex.: em `lib/fiscal/resumo.ts`) voltar a tratá-lo como
sinal de abatimento.

---

## 4. Risco de aceitar cegamente o percentual — e validação mínima

**Sim, risco real, em pelo menos três direções** [Certain quanto à existência
do risco]:

1. **Confundir INSS com ISS** (já documentado em 2026-08-18 com um caso real
   de 4,6228%). Mitigação: o app **nunca rotula** a linha antes do Mateus
   escolher — mostra o número exatamente como está na nota, ao lado do texto
   literal do campo na NFS-e (se ele digitar/anexar), e pergunta a que tributo
   se refere, com "não sei" como resposta válida.
2. **Tratar percentual informativo do Simples como se fosse dinheiro
   descontado**, inflando a impressão de "já paguei retenção" quando nada saiu
   da conta dele. Mitigação: `e_desconto_efetivo` é pergunta obrigatória e
   **sem default**; o texto ao lado explica a diferença em uma frase.
3. **Validar um "mínimo devido"** — **não é viável e não vou recomendar
   tentar.** [Certain quanto à recusa] O app não tem a RBT12 da empresa
   prestadora, não sabe o Anexo dela com certeza, e qualquer "faixa esperada"
   codificada no produto seria **regra fiscal fabricada sem lastro** — o tipo
   exato de coisa que este agente existe para impedir. O app **não valida se
   o percentual está certo**; ele só garante que o percentual **tenha
   explicação atribuída por humano**, nunca por inferência do sistema.

**Validação mínima que faz sentido no registro** [Certain]:
- Bloquear soma: se `e_desconto_efetivo = true` para alguma linha, o
  fechamento `Σ pagamentos vinculados == valor_bruto_nota` já é a validação —
  ela pega tanto retenção esquecida quanto retenção inventada.
- Nunca permitir salvar a nota com a linha de INSS preenchida e
  `natureza_do_percentual_inss` vazio — campo vazio pergunta, aqui vale igual.
- Se o percentual encontrado for **exatamente 11%** sobre o valor total da
  nota, **não presumir que está correto** — pelo §0, isso também é atípico
  para tomador PF e merece a mesma pergunta, não um passe livre por coincidir
  com o número "esperado" do senso comum.

---

## 5. Perguntas ao Mateus — uma linha cada, antes de fechar ticket

- **P1** — Francisco e Alex emitem **NF de serviço com CNPJ** (Simples
  Nacional) ou são **autônomos PF** com recibo? (muda o regime inteiro — §1)
- **P2** — Nas notas deles, **qual é o texto exato do campo** que mostra 3% e
  4,8% — está rotulado "INSS", "CPP", "ISS", "retenção", ou é uma linha de
  "composição do Simples/DAS" sem a palavra "retenção"?
- **P3** — Esse percentual **reduz de fato o quanto você transfere** para eles
  (você paga 97% ou 95,2% do valor da nota), ou você paga o valor cheio e o
  percentual é só uma informação impressa?
- **P4** — Se reduz o pagamento: **para onde vai a diferença** — você recolhe
  alguma guia, ou é a prestadora quem afirma recolher por conta própria?

---

## 6. O que este parecer NÃO muda

- **Custo de aquisição continua sendo o valor bruto da nota**, no ano de cada
  pagamento, qualquer que seja o percentual de retenção ou sua natureza
  (§4 de 2026-08-18, reafirmado aqui).
- **O invariante corrigido em A.1 permanece de pé, agora com evidência
  adicional**: nenhuma retenção de INSS art. 31, de nenhum percentual, é
  esperada como legítima em nota emitida para o Mateus como pessoa física.
- **A aferição do CNO segue dependendo só da declaração vinculada** — este
  parecer não abre uma via alternativa de abatimento via percentual de nota.

---

## 7. Automático × exige contador humano (CRC)

**O sistema pode sozinho**: capturar percentual, valor e base de cada linha de
tributo da nota, sem interpretar; exigir que o Mateus classifique a natureza do
"INSS" mostrado (art. 31 / CPP informativo / não identificado); fechar
`Σ pagamentos == valor bruto`; nunca somar percentual de retenção na base do
SERO; manter a pergunta de vínculo ao CNO (A.5, Pergunta 2) como o único campo
que afeta a aferição.

**Exige CRC**:
1. Confirmar, com a contabilidade de Francisco e de Alex, o que aquele
   percentual representa e se corresponde a alguma obrigação real de
   recolhimento.
2. Se, em algum cenário concreto, restar dúvida sobre se o Mateus se equipara
   a empresa contratante para efeito do art. 31 (não identifiquei fato novo
   que sugira isso, mas não é análise que este parecer fecha sozinho).
3. O enquadramento (Anexo/faixa) de cada prestador no Simples, caso vire
   relevante para entender a origem do percentual.

**O contai redige, dateia e organiza. Não assina.**

---

# ADENDO — 2026-09-19 · resposta ao §5, e a nota real quebra a premissa do §3

- **Provocação**: respostas do Mateus às P1–P4 do §5, mais um pedido dele de
  generalização — "Francisco/Alex foi só exemplo, podemos ter N outras
  empresas envolvidas", ou seja: nenhuma solução pode depender de conhecer o
  regime/enquadramento de um prestador específico.
- **Fato novo decisivo**: a nota do Francisco **não discrimina por tributo**.
  O campo é uma **linha única**: *"Total das Retenções (ISSQN / Federais)"* —
  um valor bruto que já mistura ISS municipal com os federais que se
  aplicarem, sem abertura. Ele confirma que não há como contar com
  nomenclatura padronizada entre prestadores futuros.
- **P3 respondida**: **sim**, o valor é abatido de fato do que ele transfere.
  `e_desconto_efetivo = true`, confirmado, não é mais hipótese.
- **P4 respondida, com incerteza**: ele não recolhe guia nenhuma; acredita
  (não tem certeza) que a contabilidade do prestador recolhe por conta
  própria. "Posso descobrir" se precisar.

## A.1 A estrutura do §3 pressupunha decomposição por tributo. Corrijo.

**O §3 estava certo no princípio e errado numa suposição implícita**: eu
desenhei "uma linha por tributo (INSS/ISS/IRRF/PIS/COFINS/CSLL)" como se toda
nota abrisse dessa forma. **A nota do Francisco mostra que isso é opcional, não
padrão.** Corrijo para uma estrutura que aguenta os dois formatos sem inventar
o que a nota não diz:

**Modelo: lista de 1..N "linhas de retenção" por documento**, cada uma capturando
só o que está impresso, mais três perguntas ao Mateus (nunca inferidas):

| Campo | O que é | Quem preenche |
|---|---|---|
| `rotulo_literal` | o texto **exatamente como aparece na nota** (ex.: `"Total das Retenções (ISSQN / Federais)"`, ou, numa nota discriminada, `"INSS"`) | copiado, não normalizado pelo app |
| `valor` | R$ da linha | copiado |
| `composicao` | enum, **sem default**: `"tributo único identificado"` (aí pede qual: ISS/INSS/IRRF/PIS/COFINS/CSLL) · `"total combinado de dois ou mais tributos, não aberto pela nota"` · `"não sei o que este valor representa"` | escolhido pelo Mateus |
| `e_desconto_efetivo` | reduziu de fato o que ele transferiu? | perguntado sempre, mesmo quando parece óbvio |

**Regra dura, no mesmo espírito do §4.3 do parecer de 2026-08-18** ("o app
NUNCA estima o percentual de mão de obra de uma empreitada"): **quando
`composicao = "total combinado"`, o app NUNCA tenta decompor o valor entre
ISS/INSS/IRRF/etc.** Um rateio inventado por chute (ex.: "geralmente é
70% ISS, 30% federais") entraria na discriminação e na análise de pendência
como se fosse fato, e não é — é o mesmo erro de fabricar rateio de material×
mão de obra, agora em retenção. **O valor combinado fica combinado.**

Isso resolve o pedido de generalização (P do Mateus) de graça: a estrutura
**não pergunta nada sobre o prestador** — nem regime, nem Anexo, nem CNPJ
específico. Pergunta apenas sobre **o documento que está na tela**, nota a
nota. Funciona idêntico para Francisco, Alex, ou a próxima empresa nunca vista,
com qualquer rótulo que a nota trouxer.

## A.2 O tratamento de `e_desconto_efetivo=true` (fechamento de pagamento) — confirmado, sem mudança

**Continua de pé, e o caso combinado não complica nada — simplifica.**
[Certain] A regra do §3 original (`e_desconto_efetivo=true` → precisa
aparecer como perna de pagamento vinculada ao documento; fechamento
`Σ pagamentos vinculados == valor_bruto_nota`) **não depende de saber quantos
tributos compõem a retenção**. Com nota combinada, é **uma linha de retenção,
logo uma perna de pagamento** — mais simples que o caso discriminado, que
poderia (em tese) gerar uma perna por tributo se cada um fosse recolhido por
guia separada.

**O que muda é o rótulo da perna, não a mecânica**: com composição
"combinado" ou "não sei", a perna não pode ser nomeada "guia de ISS" nem "guia
de INSS" — é **"retenção não discriminada, presumivelmente recolhida por
terceiros"**, com a mesma pendência já prevista no §5.3 do parecer de
2026-08-18, generalizada de ISS para qualquer retenção: o app **pergunta**
*"quem recolhe este valor — você ou a empresa?"*, sem default, e enquanto não
houver resposta (ou comprovante), a nota fica **parcialmente resolvida** —
não bloqueada, mas com pendência nomeada. **A resposta do Mateus em P4 ("não
tenho certeza, posso descobrir") é exatamente o estado "ainda não sei" que o
campo precisa aceitar como primeira classe**, não como erro de preenchimento.

**Nenhum efeito no custo de aquisição**: continua bruto da nota, igual antes,
composição da retenção é irrelevante para essa conta (§4 e §6 do corpo do
parecer, inalterados).
**Nenhum efeito na aferição do SERO**: continua zero, pela mesma razão de
sempre — só a declaração vinculada ao CNO abate, nunca o valor ou a
composição de uma retenção (§2, inalterado).

## A.3 `natureza_do_percentual_inss` estava mal nomeado — generalizo para `natureza_da_retencao`, e a mudança é mais que cosmética

**Confirmo a suspeita do Mateus: sim, precisa generalizar, e não é só
renomear.** [Certain] O campo original nasceu enquadrado em "isto é sobre
INSS" porque o caso de origem (Francisco 3%, Alex 4,8%) veio descrito como
retenção de INSS. A nota real mostra que **a própria nota não separa INSS de
nada** — a pergunta "isto é INSS?" pode nem fazer sentido para uma linha
`"Total das Retenções (ISSQN / Federais)"`.

**Correção**: o campo deixa de ser "qual é a natureza do INSS" e vira parte do
`composicao` já descrito no A.1 — **não é mais um campo à parte, é o mesmo
enum**, porque perguntar "isto é INSS, sim ou não?" como pergunta isolada
some quando a linha já é declaradamente combinada. A pergunta certa, sempre,
é uma só: **"o que esta linha representa?"**, com as três respostas do A.1
(tributo único identificado / combinado não aberto / não sei) — nunca
assumindo INSS como caso especial.

**Isso é compatível com a estrutura que eu já tinha recomendado?** Sim, na
essência (lista de linhas, sem default, sem inferência, per-documento e
prestador-agnóstica) — o que eu erro foi batizar o campo com o nome do
tributo que motivou a pergunta, em vez de nomeá-lo pela pergunta que ele
realmente responde. Ajuste de nomenclatura no parecer, sem mudança de
princípio fiscal.

## A.4 O que fica pendente de verificação (P4), e por que vale a pena o Mateus checar

**Ele disse que pode descobrir se a contabilidade do prestador recolhe por
conta própria — recomendo que descubra, e explico por que isso não é
curiosidade.** [Likely] Se **ninguém** recolhe — nem o Mateus, nem a
contabilidade do prestador —, ele está pagando um valor líquido menor do que
deve **sem nenhuma obrigação quitada em contrapartida**: o dinheiro
simplesmente não chegou a lugar nenhum, e mais cedo ou mais tarde alguém
(fisco ou o próprio prestador, numa cobrança futura) vai notar a diferença
entre o bruto da nota e o líquido pago. É o mesmo mecanismo de risco do §5 do
parecer de 2026-08-18 (ISSRF indevido), generalizado: **"retenção que ninguém
recolhe" não é economia, é passivo não identificado.** Isso não bloqueia o
produto nem vira validação automática — vira, de novo, a pergunta obrigatória
"quem recolhe?" do A.2, sem default.

## A.5 O que este adendo NÃO muda

- A recusa em estimar percentual "esperado" ou validar contra tabela do
  Simples (§4 do corpo) — continua de pé, e a generalização pedida pelo
  Mateus reforça isso: sem saber o prestador, muito menos dá para supor
  faixa/Anexo dele.
- `documento.retencao11 boolean` continua devendo sair do schema (§3 do
  corpo) — o caso do Francisco é ainda mais incompatível com um boolean do que
  o caso original, porque agora nem "é 11%?" nem "é INSS?" fazem sentido como
  pergunta binária.
- Nenhuma mudança em custo de aquisição ou aferição do SERO, como já dito no
  A.2.

**O contai redige, dateia e organiza. Não assina.**

---

# ADENDO 2 — 2026-09-25 · o A.2 nunca foi implementado em `alocarCusto`; achado por auditoria de código, não por relato

- **Provocação**: o Mateus flagrou contradição entre o que o `contador` disse
  nesta sessão ("para um exemplo de nota de R$10 com R$0,50 de retenção
  destacada, o custo de aquisição do ano é R$10,00, o bruto — não R$9,50") e o
  comportamento real de `lib/fiscal/vinculo.ts`, confirmado por leitura de
  código (não suposição): numa nota real dele (NFS-e municipal, Simples
  Nacional, ISSRF), a tela mostra **"Custo comprovado"** (o valor pago,
  descontada a retenção) e **"Excedente da nota — nota ainda não paga"** (o
  valor da retenção em si), com o texto
  `VINCULO_...`/`excedenteNotaCentavos` explicando que "sem desembolso não há
  dispêndio" e que o pedaço "passa a contar quando o pagamento existir e for
  ligado aqui" — tratando a fatia retida como se nunca tivesse sido paga.
- **Fato de código, verificado por leitura integral de `lib/fiscal/vinculo.ts`
  nesta data**: a palavra `retencao` não aparece nesse arquivo. `alocarCusto` e
  `valorElegivelDoPagamento` só enxergam `Pagamento` (registros de
  PIX/transferência/etc.) vinculados via `documentoIds`; `documento_retencao`
  (CONTAI-038) não entra em nenhuma soma de custo. `Σ pagamentos elegíveis`
  fecha contra `valor_bruto_nota` sem a linha de retenção nunca poder
  contribuir, mesmo com `e_desconto_efetivo = true`.

## Veredito: **(A)** — o código está fiscalmente errado, o parecer (A.2) já estava certo

[Certain] O **A.2** desta mesma resposta já normatizava exatamente o mecanismo
que falta:

> "`e_desconto_efetivo=true` → esse valor precisa aparecer como **perna de
> pagamento** vinculada ao mesmo documento (mesmo mecanismo do fechamento
> `Σ pagamentos == valor_bruto_nota`)."

Isto é uma instrução direta para o cálculo que hoje vive em
`alocarCusto`/`Componente.somaPagamentosCentavos`: uma linha de
`documento_retencao` com `e_desconto_efetivo = true` **deveria** somar aí, do
mesmo jeito que um `Pagamento` vinculado soma. O código nunca implementou essa
parte do A.2 — só a metade que vira pendência de "quem recolhe" (CONTAI-038,
citado no `CLAUDE.md` como dívida D57, mas D57 ali é descrita só do lado da
**aferição** do SERO; este adendo identifica que a mesma lacuna também
existe do lado do **custo de aquisição**, que é conta separada e mais grave em
termos de R$, porque afeta ganho de capital tributável na venda).

**Isto não é mudança de regra — é confirmação de que a regra já escrita não
foi seguida pela implementação.** O comentário do `contador` nesta sessão sobre
"R$10,00, o bruto" estava certo no **valor final esperado**, mas incompleto ao
não repetir explicitamente o mecanismo do A.2 (retenção vira perna de
pagamento) — o que, lido isolado do parecer, pode ter parecido a alguém que
bastava o documento existir. Não basta: precisa da linha de retenção **e** da
confirmação `e_desconto_efetivo = true` **e** dessa linha entrar na soma de
`alocarCusto` como perna de pagamento. O parecer já exigia os três; o código
só tem os dois primeiros.

### Resposta a cada pergunta

**1. Retenção conta como desembolso para regime de caixa (IN SRF 84/2001,
art. 17)?** [Certain] **Sim, quando `e_desconto_efetivo = true`.** Natureza
jurídica: quitação por retenção é uma forma de extinção de obrigação
funcionalmente idêntica a "transferir o valor cheio ao prestador e o prestador
imediatamente repassar a fatia ao Fisco/à própria contabilidade dele" — o
efeito patrimonial sobre o Mateus é o mesmo (o preço total do serviço foi
satisfeito), e o critério de "documentação hábil e idônea" do art. 17 não
exige que a moeda tenha fisicamente passado pela mão do prestador, exige que o
dispêndio esteja comprovado. `e_desconto_efetivo = true` **é** a comprovação:
é a confirmação (do Mateus, olhando a nota) de que aquele valor **de fato**
reduziu o quanto ele transferiu e que o prestador não vai cobrá-lo de volta —
ou seja, que o preço total foi quitado, só que por um canal diferente do PIX.
Isso vale **independentemente de quem tem o dever legal de reter** (o §0 do
corpo já havia derrubado que o Mateus, PF, tenha dever de retenção do art. 31
— irrelevante aqui: o que conta não é "quem era obrigado a reter", é "a
obrigação de pagar aquela fatia do preço foi extinta ou não").

**2. A partir de que momento conta?** [Certain, conforme o A.2 já escrito]
**A partir de `e_desconto_efetivo = true`, isoladamente — nunca espera
`quem_recolhe`.** São dois trilhos ortogonais, e o código de hoje os
confundiu ao não implementar nenhum dos dois corretamente:
  - **Trilho custo de aquisição**: `e_desconto_efetivo = true` → linha conta
    como perna de pagamento → pode fechar `Σ pagamentos == valor_bruto_nota`
    → custo comprovado = bruto, **mesmo com `quem_recolhe` ainda não
    respondido**.
  - **Trilho compliance/passivo em aberto**: `quem_recolhe` sem resposta →
    pendência nomeada e **separada** ("alguém pode estar devendo ao Fisco e
    ninguém sabe quem" — A.2, A.4), que não trava, não bloqueia, e **não deve
    aparecer como "nota ainda não paga"**, porque isso é uma frase sobre
    dinheiro sem destino, e aqui o dinheiro **tem** destino conhecido (ficou
    com o prestador, ou foi recolhido pela contabilidade dele) — só não se
    sabe ainda se o recolhimento de fato aconteceu.

**Critério técnico para `alocarCusto`** (normativo, decisão de como
implementar é do `cto-obra`): `documento_retencao.e_desconto_efetivo = true`
deve somar em `somaPagamentosCentavos` do componente conexo do documento,
tratada como perna de pagamento, **independente do valor de `quem_recolhe`**.

**3. O caso "quem_recolhe resolvido, sem pendência nenhuma aberta" mostrando
"excedente, nota ainda não paga" para sempre — é intenção ou lacuna?**
[Certain] **É lacuna, não intenção — e é fiscalmente errada e produto ruim ao
mesmo tempo, como o Mateus suspeitou.** Fiscalmente errada porque subestima o
custo de aquisição no ano do pagamento, o que **infla o ganho de capital
tributável na venda futura** (cada real de custo não reconhecido é, lá na
frente, até 22,5% de imposto a mais sobre aquele real, na faixa mais alta do
art. 40 progressivo). De produto porque alarma permanentemente um estado que
já está resolvido e documentado, sem meio de sair do alarme — o oposto do que
o app deveria fazer com um caso encerrado.

## Impacto observado

Na nota real citada pelo Mateus (valor da retenção omitido aqui de propósito
— este arquivo é versionado em repositório público): o valor integral da
retenção destacada fica ausente da soma que alimenta a ficha Bens e Direitos,
só por essa nota. Sem
levantamento de quantas notas do acervo têm retenção confirmada
(`e_desconto_efetivo = true`) e ficam no mesmo estado, o efeito agregado é
desconhecido — mas o mecanismo que causa o problema **não é específico dessa
nota**, é estrutural em `alocarCusto`, então provavelmente afeta toda nota com
retenção confirmada no acervo. [Likely quanto à extensão; Certain quanto ao
mecanismo]

## Recomendação normativa para o gate fiscal do ticket (arquitetura é do `cto-obra`)

1. `documento_retencao` com `e_desconto_efetivo = true` soma em
   `Componente.somaPagamentosCentavos` (ou equivalente) em `alocarCusto`,
   como perna de pagamento, tão logo confirmada — sem esperar `quem_recolhe`.
2. `DocumentoAlocado.excedenteNotaCentavos` (e o texto de tela que o
   acompanha) precisam distinguir dois motivos de excedente que hoje colapsam
   no mesmo número e no mesmo texto: (a) falta pagamento genuíno — nenhum
   destino conhecido para aquela fatia — vs (b) fatia já explicada por
   retenção confirmada. **Só (a) deveria dizer "nota ainda não paga."**
3. A pendência "quem recolhe" continua existindo, é ortogonal, e não deve
   usar o mesmo texto/cor de "nota não paga" — ela é sobre um risco de
   recolhimento em aberto, não sobre custo de aquisição não comprovado.
4. Tratar como **P0**: efeito é quantificável, real, e na direção que
   interessa ao Fisco contra o Mateus (subestimar custo → pagar mais imposto
   no futuro) — a mesma direção de erro que os pareceres anteriores
   classificam como a "menos perigosa" para o Fisco cobrar do Mateus depois,
   mas que já é dinheiro saindo do bolso dele sem necessidade.

## O que este adendo NÃO muda

- §0, §1, §2 do corpo — aferição do SERO inalterada: retenção, de qualquer
  natureza ou percentual, nunca abate a base do CNO. Isso é assunto
  completamente separado do que este adendo corrige.
- §6/A.2 — natureza do percentual (art. 31 / CPP informativo / ISS /
  combinado / não identificado) continua irrelevante para o **valor** do
  custo de aquisição: é sempre o bruto da nota. Este adendo não muda o
  valor-alvo, só confirma que faltava (e continua faltando, no código) o
  mecanismo para chegar nele.
- A recusa em estimar ou presumir percentual (§4) e em decompor retenção
  combinada (A.1).

**O contai redige, dateia e organiza. Não assina.**

---

# ADENDO 3 — 2026-09-25 · `quem_recolhe = "eu"` é exceção real, não caso geral; e a retenção não tem data própria

- **Provocação**: o `cto-obra`, desenhando o fix da recomendação 1 do ADENDO 2
  ("linha de retenção soma como perna de pagamento, independente de
  `quem_recolhe`"), achou colisão mecânica com `linhaSemRecolhedor`
  (`lib/fiscal/retencao.ts:341`) e o E2E de `quem_recolhe = "eu"`
  (`e2e/retencao.spec.ts:356`, fixture sintética: nota de R$18.000, PIX de
  R$17.460 ao prestador + GUIA de R$540 paga à parte pelo Mateus). Aplicar a
  recomendação 1 ao pé da letra faz o sistema contar R$540 antes de a guia
  existir (falso "coberto") e R$1.080 depois dela existir (contagem em
  dobro). Devolveu duas perguntas técnicas, ambas dentro da minha competência
  (regime de caixa e comprovação de dispêndio), não de arquitetura.

## Resposta desconfortável primeiro

**A recomendação 1 do ADENDO 2 estava certa em espírito e errada por excesso
de generalidade — eu devia ter escrito a exceção junto, não deixado o
`cto-obra` achar por auditoria de novo.** [Certain] `quem_recolhe = "eu"` não é
"mais um valor do enum" que a regra geral atravessa: é o único dos três
estados em que **o dinheiro retido ainda está no bolso do Mateus**, não em
trânsito para o Fisco. Tratá-lo igual aos outros dois é o mesmo erro estrutural
que o ADENDO 2 apontou no código (confundir "existe retenção destacada" com
"existe desembolso") — só que desta vez na minha própria recomendação, não na
implementação.

## Pergunta 1 — confirmado, com o critério exato do `cto-obra`

[Certain] **Sim: a linha de retenção soma como perna de pagamento em
`alocarCusto` se e somente se `e_desconto_efetivo = true` E
`quem_recolhe ∈ {"empresa", "nao_sei"}`. Quando `quem_recolhe = "eu"`, a linha
NUNCA soma — a perna de pagamento continua sendo exclusivamente a GUIA que o
Mateus paga de verdade, mecanismo já implementado e coberto pelo E2E, sem
tocar em `linhaSemRecolhedor`.**

**Por que a distinção é fiscalmente real, não conveniência de código** — o
teste do regime de caixa (IN SRF 84/2001, art. 17) é sempre o mesmo:
*a fatia de R$540 já saiu, de forma definitiva e comprovável, da esfera
econômica do Mateus, sem que ele ainda precise fazer nada mais para
extingui-la?*

- **`"empresa"` e `"nao_sei"`**: **sim.** O Mateus já transferiu só o líquido
  (R$17.460) e não tem, daqui para frente, nenhum pagamento adicional a fazer
  para quitar o preço da nota — o que resta é saber se **outra pessoa**
  (a prestadora, ou "ainda não se sabe quem") recolheu para o Fisco, o que é
  **risco de compliance de terceiro**, não obrigação pendente do Mateus. Isso é
  exatamente o que o A.2 já chamava de "quitação por retenção... independente
  de quem tem o dever legal de reter" — a obrigação do Mateus **acabou** no
  momento em que `e_desconto_efetivo = true` foi confirmado, porque ele não vai
  desembolsar mais nada por essa nota. A pendência "quem recolhe" que fica
  aberta enquanto `"nao_sei"` não é uma dúvida sobre **quanto o Mateus pagou**
  — é dúvida sobre **o que aconteceu depois que o dinheiro saiu da mão dele**,
  o que a jurisprudência de custo de aquisição não exige resolver (o
  comprovante que a IN 84/2001 pede é do dispêndio DELE, não da baixa fiscal de
  terceiro).
- **`"eu"`**: **não.** Aqui a obrigação de completar o preço **não acabou** —
  ela só migrou de "pagar ao prestador" para "pagar ao Fisco", e essa segunda
  perna **ainda não aconteceu** no momento em que a linha é gravada. Regime de
  caixa não permite reconhecer um dispêndio pela **intenção futura** de pagá-lo
  — só pelo pagamento em si. Enquanto a guia não existir, o Mateus **está
  literalmente com os R$540 no bolso**: economicamente idêntico a ele ainda
  não ter pago aquela fatia do preço. Contar a linha como perna aqui seria
  reconhecer custo por um valor que, até prova em contrário (a guia), **ele
  ainda tem, não gastou**.

**Efeito nos dois cenários de quebra do `cto-obra`, resolvidos**:
- Antes da guia: com o critério acima, a linha (`quem_recolhe = "eu"`) não
  soma nada. `Σ = 17.460` (só o PIX) → excedente de R$540, nota corretamente
  "ainda não paga" para os R$540 que faltam. Nenhum falso "coberto".
- Depois da guia: a linha continua não somando (exclusão é permanente para
  `"eu"`, não "até a guia aparecer"). `Σ = 17.460 (PIX) + 540 (guia) = 18.000`
  — bate com o bruto, sem sobra e sem dado contraditório. A guia, sendo um
  `Pagamento` de verdade com sua própria data, já resolve sozinha tudo que a
  linha faria — somar as duas seria contar o mesmo real duas vezes, com dois
  nomes diferentes.

**Não é "outro critério" — é o critério do `cto-obra`, ratificado por inteiro**,
inclusive na forma: guardar a exceção dentro de `linhaSemRecolhedor`/da soma de
`alocarCusto` como um `if (quem_recolhe === "eu") não soma`, e não como uma
condição temporal ("soma até a guia aparecer, depois some duas fontes") — a
exclusão de `"eu"` é **de estado**, não de tempo.

**Nota de acompanhamento, não bloqueante**: se uma linha nascer `"nao_sei"`
(contando para o custo) e depois for **editada** para `"eu"` (o Mateus descobre
que é ele quem tem de recolher), o custo do documento **cai** retroativamente
até que uma guia real seja registrada e vinculada. Isso é correto do ponto de
vista fiscal (o dispêndio nunca existiu enquanto não havia guia — o sistema só
estava com uma suposição otimista), mas é uma consequência de produto que o
`cto-obra` precisa desenhar (ex.: se o ano já foi declarado, a mudança deveria
gerar um alerta explícito de "custo declarado precisa de revisão", não um
recálculo silencioso). Normativo: **decidir a UX é do `cto-obra`; a regra
fiscal é a que está acima e não muda com o timing da edição.**

## Pergunta 2 — ratificada: data do pagamento vinculado mais antigo, sem coluna nova

[Certain] **Concordo com a proposta do `cto-obra`: a retenção NÃO precisa de
data própria — ela usa a data do pagamento vinculado mais antigo do mesmo
`documento`, e migration nova não é necessária.**

**Por que isso é a regra certa, não só a mais barata** — a retenção (nos casos
que contam, `"empresa"`/`"nao_sei"`, pela Pergunta 1) não é um pagamento com
existência própria: **nenhuma transferência aconteceu naquele valor exato, em
nenhuma data**. Ela é uma **ficção de quitação** amarrada à nota, e uma ficção
de quitação não tem data de nascimento independente da nota — ela só passa a
ser **defensável como dispêndio comprovado** quando existe, no mundo real, ao
menos um desembolso contra aquele documento. Antes disso, a pergunta "em que
ano isso conta?" não tem resposta que não seja inventada, porque **nenhum real
saiu da conta do Mateus ainda para nenhum documento sem pagamento vinculado**
— retenção incluída. É a mesma lógica de caixa da Pergunta 1, aplicada ao
eixo do tempo em vez do eixo do "quanto": **sem desembolso, não há dispêndio;
sem dispêndio, não há data; sem data, a linha não entra em soma de ano
nenhum** — fica "pendente de data" exatamente como hoje já fica "pendente de
paga" uma nota sem nenhum pagamento vinculado.

**Por que NÃO dar data própria à retenção (rejeito a alternativa "data da
nota", mesmo que custasse só uma coluna)**: a data da nota é a do **fato
gerador do serviço**, não a de um **pagamento** — usá-la fixaria a retenção no
regime de **competência**, que é exatamente o regime que a IN 84/2001 art. 17
e todo o restante deste parecer (§0 do corpo, "regime de caixa: entra no ano o
que foi efetivamente pago") já rejeitaram para toda e qualquer linha de custo
do produto. Abrir uma exceção de competência só para a retenção quebraria a
única regra de data que o sistema tem, para o único tipo de linha que menos
precisa dela (porque ela é sempre acessória de pagamentos que já têm data
própria).

**Detalhe normativo que falta na proposta do `cto-obra`, para fechar sem
ambiguidade**: "o pagamento vinculado mais antigo" tem de ser **do mesmo
`documento_id`**, não do "componente" agregado nem de qualquer pagamento do
prestador em geral — dois documentos diferentes do mesmo favorecido não podem
emprestar data um do outro. E **"mais antigo" é o critério certo, não "mais
recente" nem "o que fechou a nota"**: a retenção (para `"empresa"`/`"nao_sei"`)
já é reconhecida como dispêndio a partir do primeiro real que sair da conta do
Mateus contra aquela nota (Pergunta 1 não exige que a nota esteja 100% coberta
para a linha contar) — então o primeiro pagamento vinculado já é o marco de
"a partir daqui existe desembolso comprovável", e é esse marco, não um
posterior, que justifica reconhecer a linha.

**O que fazer se o documento não tiver NENHUM pagamento vinculado ainda**:
a linha de retenção — mesmo `e_desconto_efetivo = true` e
`quem_recolhe = "empresa"` (pendência fiscal já fechada, E2E confirma) — **não
entra em nenhum ano**, fica de fora de `alocarCusto` até que exista ao menos
um pagamento vinculado ao documento. Isso não é uma lacuna nova: é o mesmo
estado que já existe hoje para uma nota sem nenhum pagamento registrado —
"custo comprovado" para ela já é zero, com ou sem retenção.

## O que este adendo NÃO muda

- O valor-alvo do custo de aquisição continua sendo o **bruto da nota**, para
  os casos em que a linha conta (§6, A.2, A.5) — este adendo só corrige o
  **quando** e o **quando não** aplicar a soma, não o valor.
- A aferição do SERO permanece inteiramente alheia a isto — nenhuma linha de
  retenção, contada ou não em `alocarCusto`, jamais abate a base do CNO (§2,
  reafirmado em todos os adendos anteriores).
- O mecanismo de `"eu"` (`linhaSemRecolhedor` + guia como `Pagamento`
  separado) **não muda uma linha de código** — este adendo confirma que ele
  já estava certo e que a mudança pedida pela recomendação 1 do ADENDO 2 é
  em outro lugar do código (a soma de `alocarCusto`), nunca nele.
- Nenhuma migration nova. A Pergunta 2 rejeita coluna de data em
  `documento_retencao`.

**O contai redige, dateia e organiza. Não assina.**

---

# ADENDO 4 — 2026-09-26 · o banner de "sem recolhedor" reaproveita o mesmo texto para dois estados fiscalmente diferentes

- **Provocação**: o Mateus respondeu "Eu" para "Quem recolhe isto?" numa linha
  de retenção, e o app continuou mostrando o banner vermelho *"Retenção
  descontada do pagamento sem confirmação de quem recolhe — se ninguém
  recolher, não é economia, é passivo não identificado."* Reação dele: *"isso
  aqui não está correto, eu coloquei que quem deve pagar aquilo ali sou eu,
  logo, se sabe quem vai pagar, eu só não paguei ainda."*
- **Achado de código, confirmado por leitura de
  `lib/fiscal/retencao.ts:495-503`**: a função `linhaSemRecolhedor` já
  distingue corretamente, na LÓGICA, dois estados que fazem a pendência
  "abrir" (um terceiro estado hipotético, `quem_recolhe = "empresa"` com nota
  não fechada, **não existe** — essa combinação sempre retorna `false`, nunca
  abre pendência):
  - **Estado A** — `quem_recolhe` ainda não tem resposta útil (`"nao_sei"` na
    prática; `null` com `e_desconto_efetivo = true` é estado inválido que o
    CHECK da migration `0017` e `validarLinhaRetencao` não deixam persistir,
    então nunca chega ao banner real).
  - **Estado C** — `quem_recolhe = "eu"` **e** a soma dos pagamentos
    vinculados à nota ainda não cobre o valor bruto (`notaCoberta = false`):
    o Mateus já confirmou que É ELE quem recolhe; falta só a guia real.
  O bug é só de **texto reaproveitado**: `app/_components/retencao.tsx:382`
  renderiza `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR` para os dois estados sem
  checar qual foi. O cálculo de custo (`retencaoContaComoPerna`) já está
  certo desde o ADENDO 3 e não muda com este adendo.

## Pergunta 1 — a distinção A/C está correta; não há um terceiro estado nem nuance entre `null`/`"nao_sei"`

[Certain] A distinção acima é exatamente a que a migration `0017` e
`validarLinhaRetencao` impõem: uma linha com `e_desconto_efetivo = true` nunca
persiste com `quem_recolhe = null`. Para toda linha gravada no banco, Estado A
é sempre `"nao_sei"` — o ramo `null` dentro de `linhaSemRecolhedor` é defesa
contra dado inválido em memória, nunca alcançado pelo banner em produção. Não
existe consequência fiscal própria para `null` que precise de um terceiro
texto.

## Pergunta 2 — as duas consequências são diferentes, e o texto genérico está certo só para uma delas

[Certain] **Estado A (ninguém confirmado)**: o texto atual continua correto
e não muda. Pela regra já normatizada no ADENDO 3, `"nao_sei"` soma como
perna de pagamento igual a `"empresa"` — o valor JÁ conta como custo de
aquisição comprovado. O risco aqui não é o custo de aquisição do Mateus: é
que a retenção pode não ter fundamento legal nenhum (para tomador pessoa
física o art. 31 não existe em percentual nenhum, §0/§2 do corpo deste
parecer) e o prestador pode voltar cobrando a diferença que descontou sem
direito — **passivo civil/de terceiro**, nunca do custo de aquisição dele.

[Certain] **Estado C (confirmado que é ele, guia ainda não paga)**: a
consequência é outra, e o texto genérico a descreve errado. Não há passivo
não identificado — o responsável já está identificado, é o próprio Mateus.
É uma pendência de **fluxo de caixa**: enquanto a guia não for paga e
vinculada ao documento, a fatia simplesmente não conta como custo (regime de
caixa, IN SRF 84/2001 art. 17) — mecânica normal do produto, não uma ameaça
por si só. O risco que o texto atual NÃO cobre, e que o texto novo cobre: se
a guia nunca for paga, dois efeitos se somam — (a) a fatia fica fora do custo
de aquisição para sempre, aumentando o ganho de capital tributável na venda
futura; (b) se o tributo por trás da retenção era de fato devido, o valor não
recolhido é dívida tributária vencida em nome do próprio Mateus, sujeita a
juros e multa — [Guessing] a alíquota de mora e o tributo exato dependem da
composição da linha (pode ser combinada/não aberta, A.1 do adendo original) e
exigem confirmação de contador humano (CRC) se a cobrança/apuração vier a
acontecer de fato; este adendo não estima valor nenhum.

## Pergunta 3 — os dois textos, prontos para constante

**Estado A** — mantém `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR` sem alteração
nenhuma:

> "Retenção descontada do pagamento sem confirmação de quem recolhe — se
> ninguém recolher, não é economia, é passivo não identificado."

**Estado C** — texto novo, citação literal para uma constante nova (sugestão
de nome: `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`):

> "Você já confirmou que quem recolhe esta retenção é você — a pendência
> aqui não é de identificação, é de pagamento: enquanto a guia não for paga
> e vinculada a este documento, esta fatia não entra no custo de aquisição
> do ano nenhum. Se a guia nunca for paga, o efeito não é apenas essa fatia
> ficar fora do custo para sempre — o valor retido se torna dívida
> tributária vencida em seu nome, sujeita a juros e multa."

## Continuação — 2026-09-26, resposta ao Gate 2 do `cto-obra` (CONTAI-059)

O `cto-obra`, desenhando a implementação deste ADENDO, trouxe três pontos que
tocam regra fiscal e por isso exigem ratificação minha antes de virarem
critério de aceite — ele fez certo em não decidir sozinho.

### Pergunta 4 — card por documento com linhas em A e C ao mesmo tempo: ratifico a prioridade, sem terceiro texto

[Certain] Ratifico a regra proposta: **se qualquer linha aberta do documento
está em Estado A, o card mostra o conjunto de texto do Estado A (chip, título
e parágrafo); só quando TODAS as linhas abertas estão em Estado C o card
mostra o conjunto do Estado C.** Não crio um terceiro texto "misto".

Razão: a ordenação de gravidade entre A e C que este adendo já estabeleceu
(Pergunta 2) não é só uma questão de tom — é uma questão de **qual ação falta
primeiro**. Estado A é um problema de fundamento (nem sabemos quem assume o
risco de a retenção não ter respaldo legal, §0/§2 do corpo do parecer);
Estado C já superou esse problema e só falta um pagamento. Enquanto existir
uma linha em A no documento, a ação pendente mais urgente continua sendo a de
A — misturar os dois textos no card não muda qual ação o Mateus precisa tomar
primeiro, só adiciona texto para ler. Um terceiro texto "misto" resolveria um
problema estético (o card não descreve 100% do documento), não um problema
fiscal — e este parecer não cria texto de consequência fiscal para resolver
estética. O nível de linha (dentro do documento, cada linha já mostra seu
próprio estado) é onde a granularidade real mora; o card é resumo, e resumo
correto é o do pior caso.

### Pergunta 5 — chip e título ficam em escopo deste ticket, não depois

[Certain] Isto **não é over-engineering — é completar a mesma correção**, e
deixá-los de fora piora a situação que motivou o ticket, não a mantém neutra.
Hoje chip e banner erram na mesma direção ("sem confirmar"), o que é uma
mentira só. Se só o parágrafo for corrigido, o card passa a ter, ao mesmo
tempo, um título dizendo "sem confirmar quem recolhe" e um parágrafo, um
scroll abaixo, dizendo "você já confirmou que quem recolhe é você" — duas
frases que se contradizem dentro do mesmo componente. Isso é pior do que o
bug original relatado pelo Mateus: antes ele desconfiava de um texto errado;
depois da correção parcial ele veria o produto se contradizer sozinho, o que
é o tipo exato de coisa que corrói confiança mais rápido. Incluir chip e
título no critério de aceite do ticket.

Redação — texto de produto (não citação de parecer, mesma convenção que os
dois textos atuais em `retencao.ts`; `designer`/`cto-obra` podem ajustar a
palavra exata, contanto que preservem os dois fatos fiscais abaixo):

- **Fato 1**: não pode dizer nem sugerir "sem confirmar" — já foi confirmado.
- **Fato 2**: não pode dizer nem sugerir "resolvido"/"quitado" — o risco da
  guia nunca ser paga (Pergunta 2) continua de pé.

Sugestão que atende aos dois:
- Chip (`CHIP_RETENCAO_GUIA_PENDENTE`): **"Guia de retenção pendente"**
- Título (`TITULO_RETENCAO_GUIA_PENDENTE`): **"Recolhedor confirmado — guia
  ainda não paga"**

### Pergunta 6 — Estado C muda de vermelho para âmbar; vermelho fica exclusivo do Estado A

[Certain] Concordo que o Estado C deveria deixar de ser vermelho, e esta
seção **é** o parecer que a D54 exige para autorizar a mudança — não fico só
"em aberto".

Razão: a cor vermelha, no produto, carrega um significado fiscal específico —
é a mesma frase que justifica o texto do Estado A, "passivo não
identificado". A Pergunta 2 deste adendo já estabeleceu, com autoridade
fiscal, que essa frase **não se aplica** ao Estado C ("não há passivo não
identificado... mecânica normal do produto, não uma ameaça por si só"). Manter
vermelho no Estado C depois de já ter escrito isso é o mesmo bug que este
ADENDO inteiro existe para corrigir — só que na cor em vez do texto: o produto
continuaria sinalizando, por um canal diferente (cor), exatamente a mensagem
que o parecer já disse ser falsa para este estado. Isso não é decorativo:
gravidade/cor é onde o Mateus decide, num relance, o que precisa de atenção
imediata — se dois estados fiscalmente distintos (um com risco presente e não
resolvido de terceiro, outro com risco contingente e sob controle dele) usam
a mesma cor mais grave da paleta, a cor deixa de discriminar informação.

Isso não significa que o Estado C vira "sem risco" (verde/neutro seria
exagero na direção oposta) — o risco de dívida tributária futura, se a guia
nunca for paga, é real e está descrito na Pergunta 2. Âmbar é a categoria
certa: atenção/ação pendente, sob controle do usuário, sem o "passivo não
identificado" do Estado A. Vermelho fica reservado exclusivamente para Estado
A daqui em diante, nesta família de pendência.

Isto vira critério de aceite do ticket: `gravidade.ts` passa a diferenciar
Estado A (vermelho, sem mudança) de Estado C (âmbar) para
`retencao_sem_recolhedor` — o nome do token/enum é decisão técnica do
`cto-obra`, a categoria de severidade é fiscal e está fixada aqui.

## O que este adendo NÃO muda

- Nenhuma migration, nenhum campo novo.
- Nenhuma mudança em `retencaoContaComoPerna`/`alocarCusto` — o cálculo de
  custo já está certo desde o ADENDO 3; este adendo é só sobre qual texto o
  usuário lê em cada estado.
- A recomendação de que `linhaSemRecolhedor` passe a expor o motivo (não só
  `boolean`) para o componente escolher o texto certo é técnica, do
  `cto-obra`/`lead-engineer` — este adendo fixa o texto e a regra fiscal por
  trás dele, não a forma de implementar a bifurcação.

## O que a continuação de 2026-09-26 muda, além do texto do banner

- A gravidade/cor do Estado C deixa de ser vermelha (Pergunta 6) — é presentation
  layer (`gravidade.ts`), sem migration e sem efeito em cálculo.
- Chip e título ganham variante para o Estado C (Pergunta 5) — mesma natureza
  de texto de produto que os já existentes, sem campo novo no banco.

**O contai redige, dateia e organiza. Não assina.**
