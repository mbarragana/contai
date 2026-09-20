# Parecer — CNO na correção de obra: o bloqueio de `podeCorrigirObra` está errado,
# e o parecer de 2026-08-23 (§2) não foi superado pelo de 24/08

**Data**: 2026-09-20
**Autor**: agente `contador`
**Origem**: review fiscal do diff do `CONTAI-007` (Gate 2), acionado porque o
`lead-engineer` implementou **bloqueio** em `podeCorrigirObra`
(`lib/fiscal/obra.ts`) seguindo a leitura do Gate Fiscal do `CONTAI-008`
(24/08), enquanto um parecer transcrito um dia antes — 2026-08-23
(`docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`,
§2) — havia concluído o oposto para a **mesma função**. Transcrito porque a
regra que segue abaixo passa a valer sozinha: **parecer que só existe no
transcript é a mesma falha que a regra proíbe, com outro nome** — e é
precisamente essa falha que este parecer corrige, porque a resposta de 24/08 à
pergunta 1 do Gate Fiscal do `CONTAI-008` **nunca foi transcrita** como parecer
próprio; existe só dentro da tabela do ticket.

---

## Veredito

**O parecer de 2026-08-23 (§2) está correto. Não foi superado pelo de
2026-08-24 — foi contrariado por ele sem que o de 24/08 o citasse ou o
enfrentasse.** A resposta de 24/08 (tabela "Gate Fiscal" do
`docs/tickets/CONTAI-008.md`, pergunta 1) reintroduz exatamente a conflação que
o parecer de 23/08 tinha acabado de apontar como o erro: usar o CNO impresso —
que é o critério da **aferição INSS** — como trava da **correção de obra**, que
é ato do **custo de aquisição**. São as duas apurações do `CLAUDE.md`, e
`podeCorrigirObra` não pode servir às duas com a mesma régua.

**A implementação do `lead-engineer` (bloqueio) segue o critério 7(b) do
`CONTAI-007`, redigido em 2026-08-10 — antes dos dois pareceres em conflito —
e por isso está tecnicamente correta em relação ao ticket como está escrito
hoje. Mas o critério 7(b), lido à luz da regra fiscal real, está errado, e por
isso este Gate Fiscal fecha com REQUEST CHANGES: não no código como reflexo do
ticket, mas no ticket, que precisa ser reaberto.**

---

## 1. Por que o CNO não pode gatear a correção de obra

`[Certain]` A âncora de todo este projeto (`CLAUDE.md`, "Invariante fiscal
central") é que **custo de aquisição** e **base de aferição INSS** são duas
apurações com regras distintas, e a data que rege uma não rege a outra. O
parecer de 2026-08-09 (§5) já tinha fixado isto para o CNO especificamente:

> "A retenção não some, mas ela nunca foi o que amarra o valor à obra — **o CNO
> é**. A aferição do SERO procura a remuneração da mão de obra declarada pelo
> prestador **vinculada àquele CNO**."

Repare no que essa frase amarra: o CNO amarra valor à **aferição**. Nenhum
parecer deste projeto jamais disse que o CNO amarra o dispêndio ao **bem** no
sentido do art. 17 da IN SRF 84/2001. Essa segunda amarração é a que
`podeCorrigirObra` está fazendo ao recusar a correção — e é uma amarração que
**nenhum** dos pareceres-fonte do `CONTAI-007` (2026-08-09) autorizou.

O que determina a que **imóvel** um dispêndio pertence, para fins de Bens e
Direitos, é o **fato de qual construção recebeu o gasto** — algo que só o
Mateus, dono da obra, pode atestar (o mesmo padrão de "só o Mateus sabe" que
sustenta `destinatario_cpf_ok`, `notaTrazCno`, e todo campo deste sistema em
que o app registra o que foi afirmado, não o que consegue verificar). O CNO
impresso é **evidência forte, mas não constitutiva**, desse fato: ele registra
sob qual matrícula de obra a empreiteira declarou aquela mão de obra ao INSS,
o que normalmente coincide com o imóvel real, mas cuja divergência (erro de
digitação da empreiteira, nota arquivada num cadastro que depois se descobriu
errado) é exatamente o cenário que o `CONTAI-007` inteiro existe para capturar
— **não para congelar**.

## 2. O saldo de dano: o mesmo cálculo do parecer de 23/08, e ele não mudou

`[Certain]` Bloquear a correção de obra por divergência de CNO tranca o custo
de aquisição **no imóvel errado**, permanentemente, sem escape no produto — a
mesma tela que existe para consertar arquivamento errado (`app/documento/[id]/obra`)
fica inutilizável exatamente no caso em que ela é mais necessária: quando a
nota já está lançada e o Mateus percebeu, meses ou anos depois, que ela deveria
compor a discriminação de outro imóvel. Sem correção, a Declaração de Ajuste
Anual segue **descrevendo um bem que não recebeu aquele gasto** — erro de fato
na ficha Bens e Direitos, que é dano certo e imediato.

Em troca, o que se protege é uma aferição que, à data deste parecer, o produto
**ainda calcula certo de outro jeito**: ver §3. O saldo continua sendo o mesmo
que o parecer de 23/08 descreveu — negativo — e nada no Gate Fiscal de 24/08
mudou essa conta. A tabela de 24/08 cita como fonte "§5.2 [do adendo de
19/08] + CONTAI-007 critério 2 + `podeCorrigirObra`" — nenhuma dessas três
fontes é sobre **este** ponto. O §5.2 é sobre o desfecho (i)/(ii) do vínculo
pagamento↔documento (uma pergunta diferente: o que fazer quando a nota **já
não vai** acompanhar o pagamento — não se o CNO deve gatear se ela pode ir). O
critério 2 do `CONTAI-007` é sobre **registro novo**, onde a lógica de bloqueio
é outra (§4 abaixo). E `podeCorrigirObra` citada como fonte da própria resposta
é circular. O parecer de 23/08 — o único que, de fato, tratou desta função e
desta pergunta — não está entre as fontes citadas. **Não foi enfrentado, foi
contornado.**

## 3. A prova está no próprio diff em revisão

`[Certain]` Este mesmo diff implementa `lib/fiscal/afericao.ts` —
`posicaoDeAfericao` — e ali a base do CNO é calculada batendo
`documento.cnoReferenciado` contra o CNO da obra em que o documento **está
arquivado no momento**, devolvendo `"cno_divergente"` (fora da base, sem
abater) sempre que não bater. Essa é exatamente a trava real que o parecer de
23/08 pediu: **"a trava real muda de camada: vai para a apuração da aferição
... só abate a base da obra X a NF de serviço cujo CNO impresso seja o de X."**

Ou seja: **o gate correto já existe neste diff, funcionando, testado
(`lib/fiscal/afericao.test.ts`)**, e não depende de `obra_id` — só de
`cnoReferenciado`. Mover a nota para outra obra não faz essa nota abater a
aferição de lugar nenhum a mais: ela continua excluída pelo mesmo motivo
(`cno_divergente`) na obra nova, exatamente como já era excluída (por motivo
distinto, mas mesma consequência) na obra antiga. **O bloqueio em
`podeCorrigirObra` não protege nada que `posicaoDeAfericao` não proteja
sozinha.** É trava redundante que só acerta o lado errado: impede correção de
custo sem impedir dano de aferição nenhum a mais, porque não havia dano
adicional a impedir.

## 4. O que continua certo, e não muda

- **Critério 2 do `CONTAI-007` (bloqueio no REGISTRO de documento novo)
  permanece bloqueio, sem alteração.** É uma decisão diferente: no registro,
  não existe ainda nenhum vínculo de custo a preservar, e a saída "registrar na
  outra obra" (pre-mortem 2) está sempre disponível sem custo nenhum perdido.
  Bloquear ali é escolher **onde** entrar, não trancar o que já existe.
- **Critério 3 (nota sem CNO → pendência) permanece sem alteração.**
- **Critério 5 / `posicaoDeAfericao` permanecem sem alteração** — é a
  implementação correta, ver §3.
- **A Q14** (de quem é a obrigação do CNO) continua travando outros ramos, e
  este parecer não a toca.

## 5. O que muda

`podeCorrigirObra` deixa de recusar por divergência de CNO. Os dois ramos que
hoje devolvem `permitido: false` passam a devolver `permitido: true` com
`aviso`, na mesma família do ramo "CNO ainda não capturado" que já existe.
**A correção acontece, com marca permanente e aviso — nunca em silêncio.**

Novo comportamento de `podeCorrigirObra` (`lib/fiscal/obra.ts`):

| Caso | Antes (bloqueio) | Depois (este parecer) |
|---|---|---|
| `cnoReferenciado` não capturado | permite, avisa | **sem mudança** |
| Nota referencia CNO; obra de destino sem CNO | **recusa** | **permite, avisa** |
| Nota referencia CNO; diverge do CNO da obra de destino | **recusa** | **permite, avisa** |
| Nota referencia CNO; bate com o CNO da obra de destino | permite, sem aviso | sem mudança |

Texto do aviso (novo, substitui os dois `motivo` de recusa — mesma disciplina
de "texto de tela com consequência fiscal é cópia do parecer"):

> "Esta NF de serviço não referencia o CNO da obra de destino. A nota **não
> abate a aferição de nenhuma das duas obras** até que a empreiteira reemita a
> nota ou retifique a EFD-Reinf com o CNO correto — mas o custo de aquisição
> segue registrado normalmente na obra para onde você a está movendo."

(A segunda frase reusa `CNO_NAO_ALCANCA_O_CUSTO`, já escrita neste mesmo diff em
`lib/fiscal/obra.ts`, hoje empregada só na tela de registro — passa a ser usada
também aqui.)

A tela (`app/documento/[id]/obra/page.tsx`) troca o ramo de bloqueio (botão
desabilitado "A revalidação do CNO barrou esta correção") pelo mesmo padrão já
usado para `decisao.aviso`: o botão "Mover o registro para a obra escolhida"
fica habilitado, com o aviso visível acima dele antes do clique.

### Redação nova exata do critério 7(b) do `CONTAI-007`

Substituir:

> (b) o comportamento vira bloqueio quando `cno_referenciado` diverge do CNO da
> obra de destino, com a mesma redação do critério 2;

por:

> (b) o comportamento passa a **permitir a correção com aviso permanente**
> quando `cno_referenciado` diverge do CNO da obra de destino, ou quando a obra
> de destino não tem CNO — **nunca bloqueia**. O aviso diz que a nota não abate
> a aferição de nenhuma das duas obras enquanto não houver reemissão ou
> retificação da EFD-Reinf, e que o custo de aquisição é registrado
> normalmente na obra de destino (texto no parecer de 2026-09-20,
> `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`). A trava
> real desta apuração é `posicaoDeAfericao` (`lib/fiscal/afericao.ts`), que já
> segrega a base pelo CNO impresso e não pelo `obra_id` — é ela quem impede a
> nota de abater a aferição errada, não `podeCorrigirObra`;

E o critério 7(c) muda de sentido — deixa de testar recusa e passa a testar a
permissão com marca:

> (c) teste que falha se a correção voltar a recusar por divergência de CNO —
> um E2E que move NF de serviço com CNO divergente para uma obra de destino e
> afirma **duas coisas**: o `obra_id` **muda**, e a nota continua fora da base
> de aferição de ambas as obras (via `posicaoDeAfericao`).

## 6. Consequência para o `CONTAI-008`

**Critério 3** ("A revalidação de CNO roda no desfecho (i), por documento")
reusa `podeCorrigirObra` — herda a correção acima automaticamente, sem reescrita
própria: a revalidação passa a **avisar**, nunca recusar o desfecho (i) por
causa do CNO.

**Critério 16** ("estado de tela achado na pergunta 1, 24/08") **deixa de
existir como está escrito**: não há mais desfecho (i) "indisponível" por CNO —
os dois desfechos continuam sempre disponíveis, e o desfecho (i), quando o CNO
diverge, carrega o mesmo aviso do §5 deste parecer junto da nota, não uma
restrição de clique.

A tabela "Gate Fiscal (Contador)" do `docs/tickets/CONTAI-008.md`, linha da
pergunta 1, precisa de nota apontando este parecer como a versão vigente — a
resposta de 24/08 ali registrada está **substituída**, não composta.

## Fecho

- **Automático**: a mudança de `podeCorrigirObra` e da tela de correção —
  nenhuma decisão nova do Mateus é necessária.
- **Só o Mateus**: nada novo aqui além do que os critérios 1-6 já exigem.
- **CRC**: nenhuma mudança nesta seção.

Esta é a autoridade fiscal vigente sobre o ponto. Qualquer parecer futuro que
queira reabrir o bloqueio precisa citar e enfrentar este parecer e o de
2026-08-23 — não reintroduzir o bloqueio por reuso silencioso de
`podeCorrigirObra`.
