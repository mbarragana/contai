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
