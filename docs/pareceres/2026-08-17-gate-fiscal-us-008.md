# Parecer fiscal — Gate Fiscal da US-008 (extração automática)

- **Data**: 2026-08-17 · **Autor**: agente `contador`, execução read-only
- **Veredicto**: **APROVADO COM RESSALVAS** — R1–R7 bloqueantes

> `[Certain]` / `[Likely]` / `[Guessing]` são do contador. Nada aqui substitui
> contador humano (CRC).

---

## 0. Extração não é backfill — mas o desenho ingênuo comete pior

A disciplina *"campo vazio pergunta, campo preenchido afirma"* nunca proibiu
preenchimento — proibiu **afirmação sem lastro**. `data_inicio_obra = created_at`
é invenção. Extração tem lastro: **o documento está no acervo e o campo aponta
para ele.** Não é a mesma classe.

A disciplina, reescrita para caber nos dois casos:

> Nenhum campo fiscal pode ficar **indistinguível** de um campo conferido. Ou
> está vazio, ou está proposto com a origem à vista, ou foi afirmado por alguém
> que respondeu.

**Três estados, não dois**: `vazio` → `proposto` → `afirmado`. Extração produz
`proposto`, nunca `afirmado`. Campo `proposto` que o schema guarda igual a um
digitado **é** o backfill com outro nome.

### A parte desconfortável

**O risco real da US-008 não é o modelo errar. É o produto fabricar confirmação
humana em massa.** Nove campos propostos + um botão "Confirmar" = um toque =
zero conferência, e o sistema passa a registrar que o Mateus conferiu o que não
olhou. **Campo vazio pergunta; carimbo mente.** É o princípio já escrito —
*"atrito sem consequência fabrica carimbo"* — cobrando a fatura.

**Decisão de desenho mais importante deste parecer:**

> **A confirmação humana muda de lugar.** Sai do ato do registro (canteiro, uma
> mão, pressa) e vai para a **revisão anual antes da declaração** (sentado, em
> abril, com o acervo do lado). Exceção: os campos que travam decisão imediata
> ou fecham janela irreversível — **destinatário/CPF**, **`data_emissao`** e
> **valor total**. Esses não esperam abril, porque a janela municipal de
> cancelamento/reemissão e a alavanca da parcela a liberar fecham antes.

Três confirmações no canteiro têm peso. Nove não têm nenhuma.

### Correção de premissa do ticket

*"XML NF-e/NFS-e, parse determinístico"* junta duas coisas diferentes. NF-e
modelo 55 é layout nacional, assinado, com chave verificável. **NFS-e é
municipal** — layout, numeração e campos variam. **São três caminhos, não dois**:
XML NF-e · XML/JSON NFS-e municipal · PDF-foto por LLM. O segundo é
determinístico no parse e **incerto no mapeamento**: exige validação por
município, uma vez, não confiança por analogia.

---

## 1. Campo a campo

Critério objetivo: **campo com dígito verificador a máquina confere; campo sem
verificador precisa de olho.** CPF, CNPJ e a chave de 44 dígitos têm DV.
**`numero`, valor e data não têm verificador nenhum** — um dígito errado é
sintaticamente perfeito e silencioso para sempre.

| Campo | XML NF-e (assinado) | NFS-e municipal | PDF/foto (LLM) |
|---|---|---|---|
| `numero` | **Automático** | Automático após validar layout | **Proposto — confirmação anual** |
| `serie` | **Automático** | Automático/ausente (declarar ausência, nunca `''`) | Proposto — confirmação anual |
| `data_emissao` | **Automático**, de `dhEmi` — **nunca `dhSaiEnt`** | Automático após validação | **Proposto — confirmação NO ATO** |
| Valor total do documento | **Automático** (total, não líquido) | Automático após validação | **Proposto — confirmação NO ATO** |
| **Valor pago** | **Nunca extraído de documento** | idem | idem |
| CNPJ/CPF do emitente | **Automático** | Automático | **Automático com validação de DV** |
| **Destinatário / "está no meu CPF?"** | Veredito automático, **exibição obrigatória** | Idem, se o layout for inequívoco | **Confirmação humana sempre, inclusive quando bate** |
| Classificação material × mão de obra | **Proposta, nunca decisão** | Idem | Idem |
| `retencao_11` | **Proposta ≠ campo fiscal** | Idem | Idem |
| `cno_referenciado` | Proposto se constar; "não consta" se não constar | Idem | Idem |

**Valor pago**: regime de caixa — quem prova pagamento é o **comprovante
bancário**, não a nota. Derivar pagamento da nota é inverter as duas apurações.

**CNPJ**: extração aqui é **melhor que digitação** — CNPJ digitado errado parte a
agregação por favorecido em dois.

**Classificação** [Certain]: o modelo da nota diz mercadoria ou serviço; **não
diz a composição**. NF de material com frete e instalação embutidos, e nota de
empreitada com material + mão de obra num valor só, são o caso comum desta obra.
Errar o rateio não muda o custo total, mas corrompe a frase *"R$ X em materiais
e R$ Y em mão de obra"* e contamina o lado do INSS. Regra: **proposta automática
quando a nota é inequivocamente de uma natureza; revisão humana obrigatória
quando há as duas na mesma nota.**

**`retencao_11`** [Certain, e é o erro mais provável do ticket]: o que abate a
base é retenção **recolhida e declarada** (eSocial/EFD-Reinf). O XML mostra o que
o emitente **destacou**. São coisas diferentes, e a distância entre elas é o
risco de pagar duas vezes. Recomenda **dois campos**:
`retencao_destacada_na_nota` (automático) e `retencao_11` (a flag que diz
"abate" — **humana**, e é a pergunta nº 1 pendente ao CRC). Se o `cto-obra`
preferir um campo só, ele fica **humano**.

**`cno_referenciado`**: **proibido preencher com o CNO da obra** — é literalmente
o `cnoReferenciado` hard-coded que o Gate 2 do CONTAI-003 recusou.

---

## 2. XML e LLM são regimes diferentes

**No XML de NF-e você não está extraindo: está lendo o documento fiscal
original.** [Certain] O PDF é representação (DANFE); o XML **é** a nota. Ler
`nNF` do XML não tem taxa de erro — tem taxa de erro de **mapeamento** (peguei a
tag errada), que é bug determinístico, reproduzível e corrigível **em lote**.
Erro de LLM é **por documento, silencioso e não reproduzível** — não se descobre
quais 6 das 400 notas saíram erradas.

**A defesa que só o XML tem**: a **chave de acesso de 44 dígitos contém CNPJ do
emitente, modelo, série, número e ano-mês de emissão, com DV próprio** [Likely —
confirmar no manual da NF-e 4.00]. Os campos extraídos podem ser conferidos
**contra a própria chave, de graça, por máquina**. Divergência entre campo e
chave não é "extração duvidosa" — é **arquivo suspeito**.

Vale parcialmente no PDF: **o DANFE traz a chave impressa**. Extraiu a chave,
confere DV, confere os campos contra ela — e o PDF de NF-e sobe quase ao nível do
XML. **PDF de NFS-e e foto de recibo não têm nada disso.**

**Requisito de acervo que sai daqui e vale mais que a extração inteira**
[Certain]: **quando existir XML, guardar o XML original no acervo, sempre, ao
lado do PDF.** Ele é revalidável contra a SEFAZ daqui a oito anos; papel térmico
desbota e PDF não prova nada sozinho. Meta 3.

**Normalização — a armadilha**: XML devolve `1042`; o DANFE imprime
`000.001.042`; a LLM lê o impresso. Mesma nota, dois valores, e o aviso de
duplicidade não dispara. **Gravar literal (R2 do CONTAI-004 intacta); normalizar
apenas para comparar** (chave `emitente + série + número`).

---

## 3. Risco por tipo de erro

| Erro | Onde aparece | Quando aparece |
|---|---|---|
| **Valor com um dígito a menos** | Acumulado subestimado → paga IR sobre ganho que não existiu | **Nunca.** Dinheiro perdido em silêncio, para sempre |
| **Valor com um dígito a mais** | Custo inflado → redução indevida de ganho | Só se fiscalizado, anos depois, com multa e juros |
| **`data_emissao` trocada** | Janela do CNO lista as notas erradas | Nunca — a lista continua saindo, bonita |
| **CNPJ do emitente errado** | Bloco B identifica nota inexistente; agregação parte em dois | Na intimação, contaminando a credibilidade do acervo |
| **CPF do destinatário errado** | Nota inábil registrada como hábil → custo sem lastro | Na intimação. **Meta 1 furada na raiz** |

**A defesa mais barata não é confirmação humana — é a testemunha
independente.** [Certain] O valor da nota vem do documento; o do pagamento vem do
extrato. **Duas fontes que não se conversam.** Divergência entre o total da nota
e a soma dos pagamentos vinculados é alarme de graça, e pega erro de extração,
erro de digitação e nota duplicada com o mesmo mecanismo.

**Assimetria**: erro para menos é invisível e definitivo; erro para mais é
visível e punível. Nenhum se corrige sozinho.

---

## 4. Proveniência: obrigatória, pelo motivo certo

**Perante a Receita, a proveniência do campo não vale nada.** [Likely, confiança
alta] O art. 17 exige dispêndio comprovado por documentação hábil e discriminado.
Numa intimação o auditor olha a **nota**, não o nosso banco. *"Este número saiu
de um XML assinado"* não é tese de defesa — **o XML assinado é a defesa, e ela
está no acervo, não no metadado.** Vender proveniência como blindagem fiscal é
conforto falso.

O valor dela é **interno, e é grande**:

1. **Torna bug de extração recuperável** — de busca manual em 400 documentos para
   uma query.
2. **Permite que a confirmação anual seja dirigida** — a lista de "campos que
   nenhum humano conferiu" só existe se o sistema souber quem preencheu o quê.
3. **Distingue a `data_emissao` que o Mateus leu no papel daquela que um modelo
   leu de uma foto tremida** — hoje indistinguíveis no schema.

Mínimo por campo: **origem** (`digitado` | `xml_nfe` | `xml_nfse` | `ia`),
**quando**, **modelo/versão do extrator** e **confirmado por humano em**.

Regra: **campo com origem `ia` e sem confirmação humana não pode ser a única
coisa que sustenta uma saída fiscal sem estar sinalizado** — entra na
discriminação, mas aparece na revisão anual (US-004) e marcado no índice do
pacote exportado (CONTAI-011).

---

## 5. O check do CPF do destinatário

**A comparação sim, o veredito silencioso não.**

Erro de enquadramento a evitar: tratar *"está no meu CPF?"* como campo
extraível. **Não é. É uma conclusão** sobre dois dados. E o modo de falha mais
provável **não é a extração**: é o CPF cadastrado estar errado, ou a nota ter
saído no CPF do cônjuge, do sócio, do irmão. Confirmação de campo não pega nada
disso; **exibir os dois CPFs lado a lado, pega**.

- **XML NF-e**: veredito automático, **exibição obrigatória dos dois CPFs**, sem
  toque de confirmação quando batem — pedir toque em campo verde fabrica carimbo.
- **PDF/foto**: **confirmação humana sempre, inclusive quando bate.** Um dígito
  lido errado converteria quarentena legítima em registro válido.
- **Divergência, em qualquer caminho**: vai para **quarentena** e **o campo não é
  editável**. [Certain] Divergência é fato sobre o papel, não erro de digitação.
  Deixar "corrigir" o destinatário no app é consertar a nota errada sem consertar
  a nota.

---

## 6. Textos de tela

**(a) Confirmação no ato — caminho PDF/foto** (os três campos numa tela só, com
o anexo visível ao lado):

> **Confira estes três no documento**
> Li de uma foto, não de um arquivo assinado — um dígito errado aqui não aparece
> em lugar nenhum depois.
> **Valor total:** R$ [valor] · **Data de emissão:** [dd/mm/aaaa] · **CPF do
> destinatário:** [cpf]
> A data de emissão **não decide o ano do custo** — quem decide é a data do
> pagamento.
> [Confere] · [Corrigir]

**(b) Destinatário divergente:**

> **Esta nota não está no seu CPF**
> Na nota: [cpf/cnpj lido] · No cadastro da obra: [cpf do dono]
> Não entra no custo de aquisição. Peça a nota no seu CPF.
> Este campo não se corrige aqui: o que precisa ser corrigido é a nota. Em NF-e,
> carta de correção **não** altera destinatário — a nota tem que ser cancelada e
> reemitida.

**(c) Nota com material e mão de obra juntos:**

> **Esta nota tem material e serviço no mesmo valor**
> A separação entra na sua declaração (*"R$ X em materiais e R$ Y em mão de
> obra"*) e é a parte de mão de obra que interessa ao INSS da obra. O sistema não
> divide sozinho.
> [Informar quanto é mão de obra] · [Deixar para a revisão anual]

**(d) Retenção destacada na nota:**

> **A nota destaca retenção de 11% (R$ [valor])**
> Isso é o que o emitente escreveu. Só abate na aferição do INSS se a empresa
> **recolher e declarar** (eSocial/EFD-Reinf). O sistema registra o destaque; a
> confirmação é sua, com o comprovante da empresa.

**(e) Campo não encontrado — o texto que substitui o default:**

> **Não achei [campo] no arquivo**
> Deixei em branco de propósito: campo fiscal preenchido por chute afirma uma
> coisa que ninguém verificou.
> [Preencher agora] · [Deixar pendente]

**(f) Divergência contra a chave de acesso:**

> **Este arquivo não bate consigo mesmo**
> O número/série/CNPJ não conferem com a chave de acesso da própria nota. Isso
> não é dúvida de leitura — é o arquivo. Confira se o PDF corresponde à nota
> certa.

**(g) Revisão anual (US-004), antes de gerar a discriminação:**

> **[N] campos que ninguém conferiu**
> Foram lidos automaticamente e nunca passaram pelo seu olho. O que vai para a
> declaração é sua responsabilidade, não a do extrator.
> [Revisar agora] · [Gerar mesmo assim e marcar no pacote]

---

## Ressalvas

### Bloqueantes

- **R1 — Três estados, não dois.** Campo extraído nasce `proposto`, com origem
  gravada, **nunca indistinguível de um digitado**. Schema sem coluna de
  proveniência = ticket volta.
- **R2 — Confirmação humana no ato limitada a três campos** (valor total,
  `data_emissao`, CPF do destinatário) **e só no caminho PDF/LLM**. O resto vai
  para a revisão anual. **Proibida a tela de "confirmar tudo" com um toque.**
- **R3 — Valor pago nunca é extraído de documento.**
- **R4 — `retencao_11` não é preenchido por extração.** Destaque ≠ recolhimento.
- **R5 — `cno_referenciado` nunca é preenchido com o CNO da obra.**
- **R6 — Divergência de destinatário vai para quarentena e o campo não é
  editável.**
- **R7 — Três caminhos, não dois.** NFS-e municipal exige validação de layout por
  município antes de ser tratada como determinística; até lá, regime de LLM.

### Não bloqueantes

- **R8 — Chave de acesso: extrair sempre que existir** (XML e DANFE), conferir DV
  e conferir os campos contra ela. Transforma erro silencioso em alarme
  determinístico.
- **R9 — Guardar o XML original no acervo quando existir**, além do PDF. Meta 3,
  e vale mais que a extração.
- **R10 — Conferência valor da nota × soma dos pagamentos vinculados**, escrita
  já agora com teste, mesmo sem efeito antes da US-003.
- **R11 — Normalizar para comparar é permitido; normalizar para gravar continua
  proibido.**
- **R12 — Registrado, fora da alçada fiscal**: nota carrega CPF, CNPJ, valores e
  endereço da obra. Tier gratuito de LLM costuma reservar direito de uso do
  conteúdo para treinamento [Likely — verificar os termos do provedor]. Decisão
  do `cto-obra`; o dado é sigiloso independentemente de quem decide.

---

## A confirmar antes de virar código

Composição exata da chave de acesso e nomes de tag do layout NF-e 4.00 [Likely];
existência e adoção do padrão nacional de NFS-e e o layout de Florianópolis
[Guessing]; **pergunta nº 1 ao CRC segue aberta** — enquanto estiver,
`retencao_11` não é candidato a automação em hipótese nenhuma.

## Exige CRC

O texto que vai à declaração; o rateio material × mão de obra em nota mista; a
validade da retenção destacada como redutora da aferição; qualquer retificadora
por erro de extração descoberto depois.

**O contai lê, propõe, marca a origem e organiza. Não confere no lugar do Mateus
e não assina.**

---

## Veredicto

**APROVADO COM RESSALVAS.** A extração é legítima e **reduz risco líquido em pelo
menos dois campos** — CNPJ e `data_emissao` no caminho XML são hoje digitados à
mão, com uma mão, no canteiro. O que ela não pode virar é uma máquina de
confirmações vazias — **e é aí, não no modelo, que este ticket morre se morrer.**
