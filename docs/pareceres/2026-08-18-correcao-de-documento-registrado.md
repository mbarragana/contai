# Parecer fiscal — correção de documento já registrado

- **Data**: 2026-08-18 · **Autor**: agente `contador`, execução read-only
- **Provocação**: Gate Fiscal do `CONTAI-021` — o app não tem nenhuma tela que
  edite documento, e o link "Corrigir na nota" (commit `b807901`) leva a uma
  tela que não corrige
- **Consome**: parecer de 2026-08-17 e seus dois adendos de 2026-08-18
- **Normativo para**: `CONTAI-021`, e para qualquer tela futura que altere dado
  de documento já gravado
- **Status**: **corrige e estende** o adendo de 2026-08-18 ("favorecido do
  pagamento que nasce ligado a uma nota"), §2. Onde os dois divergirem, vale
  este.

> `[Certain]` / `[Likely]` são do contador. Nada aqui substitui contador humano
> (CRC).

---

## 0. Duas correções de enquadramento

**(a) Nenhuma data do `documento` move custo entre anos-calendário.**
`data_emissao` **nunca** governa o ano do custo — está fechado no parecer do
CONTAI-004 e não se reabre. O único campo de `documento` que pode mover custo
entre anos é **`valor`**, porque muda `C = min(Σ pagamentos, Σ documentos)` e a
repartição cronológica retira/acrescenta a partir do pagamento **mais recente**.
O campo que move custo por data é `pagamento.data_pagamento`, e ele não está
neste escopo. Escreva "correção de **valor**", nunca "de valor/data".

**(b) "CNPJ/CPF não é corrigível" ≠ "`documento.favorecido_id` não é
corrigível".** O que é imutável é a **string CNPJ/CPF de um favorecido já
cadastrado**. O **ponteiro** do documento para outro favorecido é exatamente o
"refazer o vínculo" que o adendo manda fazer. O adendo ficou ambíguo nisso; §4
abaixo desfaz.

---

## 1. Lista fechada de corrigibilidade, campo a campo

| Campo | Veredito | Condição |
|---|---|---|
| `valor` | **CORRIGÍVEL COM CONDIÇÃO** | (i) valor **no papel anexado** difere do gravado → corrigível (transcrição); (ii) valor **da nota** está errado → **não corrigível**, só NF substitutiva (§3); (iii) havendo pagamento vinculado **e** mudando a alocação de algum ano anterior ao corrente → **avisa antes de gravar e deixa pendência de retificadora** (§5). `null → valor` (dor D-018.5) é o mesmo caminho, sem exceção |
| `tipo` | **CORRIGÍVEL COM CONDIÇÃO** | só **dentro da família NF**: `nf_material ↔ nf_servico`. Ao trocar, o app **reabre e exige de novo** `classificacao` e `retencao_11` — nunca herda a resposta anterior. **Atravessar de/para `boleto` é NÃO CORRIGÍVEL**: `arquivo_path` é o papel, e boleto e NF são papéis diferentes. A NF que chegou depois do boleto é **registro novo**, ligado ao mesmo pagamento |
| `classificacao` | **CORRIGÍVEL** sempre | sem trava. Não muda total nenhum; muda a **composição** (material × mão de obra) da discriminação. Ano já declarado → aviso menor: *a composição declarada muda, o total não*. Marcenaria fixa/planejados continua **revisão humana** |
| `vencimento` | **CORRIGÍVEL** sempre, sem aviso | não decide ano, não decide custo, não entra em relatório fiscal |
| `destinatario_cpf_ok` | **CORRIGÍVEL COM CONDIÇÃO — assimétrica** | **`sim → não`**: livre (direção segura — tira custo). O app **força `status='quarentena'` e escreve `motivo_quarentena` na mesma gravação** (constraint `documento_quarentena_coerente`). **`não → sim`**: permitido, **nunca como toggle** — exige, no mesmo ato, anexo visível na tela, afirmação explícita *"o nome e o CPF impressos no documento anexado são os meus"*, e rastro. **Nunca em lote, nunca a partir de uma lista** |
| `status` | **NÃO CORRIGÍVEL** | é **derivado** (`tipo` + `destinatario_cpf_ok` + vínculo). Muda como **consequência** de corrigir um fato, jamais por escolha. Dropdown de status é o caminho de fraude silencioso: não exige mentir sobre fato nenhum, só escolher um valor |
| `motivo_quarentena` | **NÃO CORRIGÍVEL** | escrito pelo sistema. O que o Mateus tiver a dizer vai em **observação append-only**, que acrescenta e nunca substitui |
| `favorecido_id` | **CORRIGÍVEL COM CONDIÇÃO** | é ponteiro, não identidade. Só grava se o CNPJ/CPF do favorecido de destino **for o impresso no anexo** — afirmação explícita na tela. Selecionar existente ou criar novo. **O CNPJ/CPF de um favorecido existente nunca é reescrito** |
| `arquivo_path` | **NÃO CORRIGÍVEL** | o anexo é a prova. Não se substitui — **anexa-se adicional** (carta de correção, NF substitutiva, 2ª via legível). O bucket já é append-only |
| `numero`, `serie` *(se o CONTAI-004 entrar antes)* | **CORRIGÍVEL COM CONDIÇÃO** | como transcrição, **texto literal** (zeros à esquerda preservados). Ao gravar, **reroda a checagem de duplicidade**: colidindo com outro documento do mesmo emitente/série na mesma obra → **aviso + revisão humana**, porque o duplicado pode ser o outro registro |
| `data_emissao` *(idem)* | **CORRIGÍVEL COM CONDIÇÃO** | data futura **recusada**. **Não gera aviso de ano declarado** — não governa o ano do custo. Muda a **janela do CNO** e a competência da aferição; entrando ou saindo da lista de cobrança, o app diz |

## 2. `destinatario_cpf_ok` é caminho de fraude do dono contra si mesmo — e mesmo assim não se bloqueia

`[Certain]` O carimbo do app não prova nada à Receita: quem assina a DAA é ele.
Bloquear não impede o dano; só garante que o acervo divirja do papel, que é a
única coisa que a fiscalização olha. O que o app deve impedir é o **flip
barato** — sem anexo à vista, sem afirmação, sem rastro, em lote. Com atrito e
rastro, o erro fica dele e fica registrado.

## 3. Os dois erros diferentes — texto de tela

Copiar literalmente; não reescrever:

> **Esse dado está errado na nota, ou só aqui no app?**
>
> Se está errado **na nota**, não dá para consertar aqui. O que vale na
> fiscalização é o papel: se o app disser uma coisa e o arquivo anexado disser
> outra, a divergência derruba a prova — e quem explica isso numa intimação é
> você.
>
> Peça ao emitente:
> - **Valor, CNPJ/CPF do destinatário ou data de emissão errados** → **nota
>   substitutiva** (cancelamento e reemissão). **Carta de correção não conserta
>   nenhum desses.**
> - **Descrição do serviço ou dado sem efeito no valor** → **carta de
>   correção**, que ele te manda em arquivo.
>
> Quando o documento novo chegar, registre e anexe. **Esta nota continua no
> acervo** — nada aqui se apaga.

`[Certain]` para **NF-e** (material): a carta de correção eletrônica não pode
alterar valores, dados que mudem remetente ou destinatário, nem data de emissão
(Ajuste SINIEF 07/05).
`[Likely] — confirmar na legislação municipal` para **NFS-e**, que é a maioria
dos serviços desta obra: a regra é do município (Florianópolis) e em geral o
caminho é cancelamento e substituição, com prazo próprio. Por isso o texto diz
"nota substitutiva" e não nomeia o instrumento — não se afirma o que não foi
confirmado.

## 4. CNPJ/CPF do emitente errado — o caminho concreto

1. **O documento antigo fica.** Não é anulado, não vai para quarentena, não se
   apaga. `[Certain]` **Quarentena tem um significado só** — destinatário ≠ CPF
   do dono, é o que a constraint carrega. Usá-la para "emitente errado" destrói
   o único sinal fiscal daquela coluna.
2. **Corrige-se o ponteiro `documento.favorecido_id`** para o favorecido cujo
   CNPJ/CPF é o **impresso no anexo** — existente ou novo. **A string CNPJ/CPF
   do favorecido antigo nunca é reescrita.**
3. **Pré-condição de gravação**: anexo visível na tela e afirmação de que o
   CNPJ de destino é o do papel. Sem isso a correção troca um erro por outro.
4. **Os pagamentos vinculados**: o vínculo `pagamento_documento` **não se
   desfaz** — ele liga pagamento↔papel, e o papel é o mesmo. Mas
   `pagamento.favorecido_id` é campo próprio e pode ter herdado o favorecido
   errado. O app **propõe** repontar cada pagamento vinculado, **um a um, em ato
   explícito, com rastro em cada**. **Cascata silenciosa é proibida** — é a
   doença do `garantirFavorecido` com outro nome.
5. **O favorecido antigo órfão fica.** Não se apaga, não se funde. Requisito
   fiscal: **não reaparece como sugestão em registro novo** e **não some do
   histórico**. Como marcar isso é decisão técnica.
6. **Ficha Pagamentos Efetuados** sai pelo favorecido efetivamente apontado.
   Órfão sem pagamento não aparece — correto. **Se o favorecido errado já saiu
   numa DAA entregue, é retificadora → CRC.**

## 5. Rastro antes→depois

**Tag mantido:** `[Likely]` — não conheço regra que exija versionamento de um
controle pessoal; **confirmar na legislação**. A exigência é da **meta 3 do
projeto** (acervo que sobrevive ao prazo de decadência), **não de norma**.

**Mudança de posição, e ela contradiz o adendo de 2026-08-18:** o adendo
condicionou o rastro a *"documento que já tem pagamento vinculado"*. **Está
errado.** "Ter pagamento vinculado" é estado **mutável e futuro**: a nota
corrigida hoje sem vínculo pode ser vinculada amanhã, e o rastro que não foi
gravado não se recupera. Condicionar rastro a um estado futuro é não ter rastro.

> **Rastro obrigatório em TODA correção, de qualquer campo da lista do §1, com
> ou sem pagamento vinculado.** Custo: uma linha.

**O que o rastro grava** — nada aqui é dispensável:

| Registro | Por quê |
|---|---|
| documento/entidade e id | identifica o quê |
| campo, **antes**, **depois** (como texto) | o antes→depois. Texto preserva `null`, zeros à esquerda e enum |
| quando (timestamptz) | data do ato |
| quem (user_id) | hoje é sempre o Mateus; a coluna existe porque o acervo sobrevive ao single-user |
| **motivo** — lista curta + texto livre: `erro_de_digitacao_minha` / `emitente_corrigiu_a_nota` / `outro` | **carrega o §3**: é a primeira pergunta de um auditor |
| **anos afetados** (snapshot: ano, custo antes, custo depois) | sem isso, a conversa de retificadora anos depois não tem prova |

**Duas regras duras:**
- **Append-only**: sem update, sem delete, nem para o dono.
- **Se `motivo = emitente_corrigiu_a_nota`, o documento novo (carta de correção
  ou NF substitutiva) é anexado no mesmo ato.** Senão o app passa a divergir do
  papel na direção oposta — o mesmo defeito com outro sinal.

## 6. Ano já declarado: avisa, mostra o delta, grava, e deixa pendência

**Não trava.** `[Certain]` Travar não desfaz o fato e produz acervo divergente
do papel — o defeito que o §2 do adendo existe para impedir. A DAA entregue não
muda porque o app se recusou a registrar.

1. **Antes de gravar**, mostra o delta por ano: *"2026 (ano já declarado): custo
   confirmado R$ X → R$ Y"*.
2. Grava, com o rastro do §5 (anos afetados incluídos).
3. **Cria pendência persistente** — *"correção afetou ano já declarado; avaliar
   retificadora com contador"* — que **não some ao fechar a tela**. Aviso que só
   existe no momento do clique é aviso que não existiu.
4. **O app não decide nem redige retificadora. CRC.**

**Relação com a dor D-018.2**: é a **mesma dor fiscal com gatilho diferente** —
lá o fato novo chega (vínculo/pagamento posterior), aqui o fato antigo é
corrigido. **O detector é literalmente o mesmo**: recalcular custo por
ano-calendário, comparar com o estado anterior, sinalizar ano já declarado.
**Construa uma vez.** Saindo duas vezes, o Mateus vê dois avisos diferentes para
o mesmo evento fiscal e aprende que são coisas diferentes — o que é falso.

⚠️ **Lacuna que trava os dois**: hoje **não existe no modelo nada que diga qual
ano-calendário já foi declarado**. Sem isso o detector nunca dispara ou dispara
sempre. Falta um dado simples que só o Mateus tem: *"DAA do ano X entregue em
DD/MM/AAAA"*. Inferir por calendário ("ano anterior ao corrente = declarado")
erra de janeiro a abril — exatamente a janela em que ele mais mexe no acervo.

## 7. Automático × humano × CRC

**Sistema sozinho** `[Certain]`: recusar edição de `status`,
`motivo_quarentena` e `arquivo_path`; recusar reescrita de CNPJ/CPF de
favorecido existente; derivar `status` de `destinatario_cpf_ok`/`tipo`; forçar
quarentena no flip `sim → não`; exigir re-resposta de `classificacao` e
`retencao_11` na troca de tipo; recusar `data_emissao` futura; rerodar
duplicidade ao corrigir `numero`/`serie`; **gravar rastro sempre**; recalcular
custo por ano e **dizer o delta antes de gravar**; manter o favorecido órfão
fora das sugestões e dentro do histórico.

**Só o Mateus** (o app pergunta, não decide): se o erro é de transcrição ou é da
nota; se o CNPJ de destino é o do papel; o flip `não → sim` em
`destinatario_cpf_ok`; repontar cada pagamento vinculado; marcenaria fixa em
`classificacao`; qual duplicata é a boa.

**Exige CRC**: qualquer **retificadora**; o efeito de correção de nome/CNPJ em
ano já declarado; se a correção de `valor` que muda ano declarado justifica
retificar ou é imaterial; o texto que vai à declaração; o efeito de
`retencao_11` corrigido na aferição do SERO — **destaque na nota não prova
recolhimento e declaração pela empresa** em eSocial/EFD-Reinf `[Certain]`; o que
abate na aferição é o efetivamente declarado, e conferir isso não é do app.

---

## Fora deste parecer, mas irmão dele

Documento registrado **em duplicidade** não se resolve editando campo: precisa
de *"marcar como duplicata de X"*, que é **anotação, não delete**. O CONTAI-004
só **avisa no registro**; depois do registro não há saída nenhuma.
