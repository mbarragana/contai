# CONTAI-073 — corrigir o valor previsto de um agendamento aberto

**Cenário: gestão** (em casa, sentado — conciliação/agenda). O "Teste do
Canteiro" não se aplica. **375px não é piso obrigatório** aqui, mas a tela
**não pode quebrar** nele: é o mesmo shell de gestão de
`/compromisso/[id]/data` e `/compromisso/[id]/cancelar`, que já rendem bem
nessa largura — não há decisão de layout desktop nova a tomar neste ticket.

## Nível do mock: **Nível 2 (spec + ASCII do bloco)**

Não é Nível 1 (HTML navegável). Justificativa: apesar de a rota ser nova, não
há nenhuma decisão de layout em aberto — é recombinação de três padrões já
testados e em produção:

- **Estrutura da tela** = `/compromisso/[id]/data/page.tsx` e
  `/compromisso/[id]/cancelar/page.tsx`: `CabecalhoDaTela` +
  `ColunaDeDetalhe` + `RodapeDeAcao` fixo, guarda de `situacao !== "aberto"`
  com `Banner` âmbar e formulário oculto, campo obrigatório de motivo no
  padrão exato de `cancelar/page.tsx` (`CampoTexto campo="fMotivo"`, erro
  "Escreva o motivo — campo obrigatório.").
- **Confirmação por resumo antes/depois, sem modal** = mesmo padrão de
  `/documento/[id]/corrigir/valor` (tabela "antes → depois" antes do botão de
  salvar) — decisão já fechada pelo `cto-obra` no Passo 3.
- **Campo de valor em reais** = `CampoTexto inputMode="decimal"
  placeholder="0,00"` + `parseValorInput`/`formatarBRL` de `lib/money.ts`,
  igual ao campo `cValor` de `/compromisso/[id]/confirmar`.

A única peça genuinamente nova é a guarda de pagamento parcial (banner + prévia
de saldo + erro), e ela é uma variação textual/condicional dentro desse mesmo
esqueleto — não abre pergunta de estrutura, cabe em spec escrito.

---

A seção abaixo é o contrato do CONTAI-034 (`lib/design/campos-do-spec.ts`): a
forma legível por máquina do que o §2 descreve em prosa. **Nenhum dos dois
campos é campo fiscal** (Gate Fiscal do ticket: `valor_previsto` é previsão
pura, não compõe custo de aquisição nem base de aferição INSS), e mesmo assim os
dois nascem VAZIOS — a disciplina de não-default vale em qualquer campo: campo
vazio pergunta, campo preenchido afirma.

## Campos

- `fValorNovo` "Novo valor previsto" — `inputMode=decimal`, `placeholder="0,00"`
  — obrigatório — **SEM DEFAULT**
- `fMotivo` "Motivo da correção" — texto livre, sem enum (`text not null` no
  banco) — obrigatório — **SEM DEFAULT**
- NÃO É CONTROLE — "Valor previsto atual" é `Linha` de leitura
  (`compromisso.valorPrevistoCentavos`), não editável; o resumo
  antes→depois e a prévia de saldo são derivados, recalculados a cada tecla.

---

## 1. Onde o link aparece — `app/(gestao)/compromisso/[id]/page.tsx`

No bloco `data-acoes="agendamento"` (linhas ~195-229 hoje), visível **só
quando `situacao === "aberto"`** — mesma guarda que já embrulha o bloco
inteiro, então não precisa de condição própria. Ordem da lista, com o item
novo inserido entre "Mudou a data" e "Marcar que não vai ser pago" (agrupa as
duas correções antes da ação mais drástica):

```
[ Registrar o pagamento ]      (ou "Ver a fatura", se origem = cartão)
[ Mudou a data ]
[ Corrigir o valor previsto ]  ← NOVO
[ Marcar que não vai ser pago ]
```

`<BotaoLink href={`/compromisso/${c.id}/valor`}>Corrigir o valor
previsto</BotaoLink>` — mesmo componente, mesma variante (secundária, como
"Mudou a data") dos vizinhos.

Nenhuma outra mudança no detalhe além desta e do card de histórico (§6).

---

## 2. Campos da tela nova — `/compromisso/[id]/valor`

| campo | rótulo | tipo | nasce | obrigatório |
|---|---|---|---|---|
| — | Valor previsto atual | leitura (`Linha`, não editável) | preenchido com `compromisso.valorPrevistoCentavos` | — |
| `fValorNovo` | Novo valor previsto | `CampoTexto inputMode="decimal" placeholder="0,00"` | **vazio** | sim |
| `fMotivo` | Motivo da correção | `CampoTexto` (texto livre, sem enum) | **vazio** | sim (`text not null` no banco) |

Disciplina fiscal: campo vazio pergunta, campo preenchido afirma — nenhum dos
dois campos nasce com valor, nem sugerido nem pré-marcado.

---

## 3. Fluxo completo

```
/compromisso/[id]  →  [Corrigir o valor previsto]  →  /compromisso/[id]/valor
                                                              │
                                    ┌─────────────────────────┼─────────────────────────┐
                                    │                          │                          │
                             situacao !== aberto      situacao === aberto,        situacao === aberto,
                             (guarda, sem form)        sem pagamento parcial       COM pagamento parcial
                                    │                          │                          │
                             explica e para          form: valor novo + motivo   + banner "já pago R$X"
                                                       resumo antes→depois         + prévia de saldo
                                                       [Salvar] → grava            [Salvar] → grava
                                                              │                          │
                                                              └────────────┬─────────────┘
                                                                           ▼
                                                          sucesso → volta a /compromisso/[id]
                                                          (valor atualizado + novo card de histórico)
                                                                           │
                                                                    erro de gravação
                                                                (inclusive corrida com
                                                                 pagamento que chegou
                                                                 durante a edição) →
                                                                 banner vermelho, nada
                                                                 muda, tenta de novo
```

Passo a passo:

1. Carrega `carregarCompromisso(id)` e, com o `obraId`, `carregarPainel(obraId)`
   (para achar os pagamentos já ligados via `compromisso.pagamentoIds`, igual ao
   detalhe faz hoje). **Só esses dois.**
   ⚠️ **Corrigido no Gate 2 (`cto-obra`, 2026-09-28): esta tela NÃO carrega
   `carregarHistoricoDeValorPrevisto(id)`.** A versão anterior desta linha
   mandava carregar, e era drift entre spec e código: o histórico não aparece
   nem é usado aqui — nenhum campo, nenhuma guarda e nenhum texto desta tela
   depende dele. Quem o lê é o **detalhe** do compromisso, para o card do §9
   (função nova, ver §7). Carregar aqui seria uma ida de rede por nada.
2. **Guarda de situação** — se `situacao !== "aberto"`: `Banner` âmbar, texto
   idêntico ao de `data/page.tsx`/`cancelar/page.tsx`: *"Este agendamento já
   foi respondido — ele foi pago. / — foi marcado como não vai ser pago. Não
   há o que corrigir de valor por aqui."* Nenhum campo aparece. O
   `RodapeDeAcao` continua renderizado (como nas duas telas irmãs), com
   `BotaoSalvar` desabilitado e `BotaoLink href="/compromisso/${id}"` "Voltar
   sem salvar" sempre disponível — nunca tela muda, nunca crash em URL direta.
3. **Situação aberta** — calcula `pago = Σ valorCentavos dos pagamentos cujo
   id está em compromisso.pagamentoIds`, `saldoAtual = max(0, atual - pago)`.
   Se `pago > 0`, mostra o banner de pagamento parcial (§4) imediatamente,
   antes mesmo de o Mateus digitar algo.
4. Ele digita o valor novo e o motivo. A cada tecla, recalcula validação (§5)
   e, quando o valor é válido, o resumo antes→depois (§4/§5).
5. Salvar só habilita com: situação aberta, `novoCentavos` válido (parseável,
   diferente do atual, maior que zero, maior que `pago` quando `pago > 0`) e
   `motivo.trim().length >= 3`.
6. Gravação (§7). Sucesso → `router.push(`/compromisso/${id}`)` direto, sem
   tela de sucesso intermediária — mesma decisão de `mudarDataPrevista`
   (correção sem impacto fiscal, sem pendência: não há por que o Mateus
   esperar numa tela extra). O "estado de sucesso" desta spec (§8) é o
   detalhe do compromisso já mostrando o valor novo e a linha nova no card de
   histórico.

---

## 4. Guarda de pagamento parcial — textos exatos

Ocorre quando `compromisso.pagamentoIds` tem ao menos um pagamento vinculado
E `situacao` continua `"aberto"` (quitação parcial via `quitarCompromisso`
com `quitaIntegralmente: false` — mesma leitura que `saldoDoCompromisso` já
faz em `lib/fiscal/compromisso.ts:699`).

**(a) Banner persistente**, logo abaixo do card "Valor previsto atual",
sempre visível nesse cenário (independe do que já foi digitado):

> **Já pago R$ {formatarBRL(pago)} contra este agendamento.** O valor
> previsto só pode subir a partir daqui — abaixo disso o saldo zeraria sem
> explicação nenhuma.

**(b) Prévia de saldo**, some/aparece conforme o campo `fValorNovo`: só
aparece quando `novoCentavos` é válido E `novoCentavos > pago` (isto é,
quando não há erro de validação disparado — ver §5). Linha adicional dentro
do resumo final (§5), não um banner à parte:

> Saldo passa de {formatarBRL(saldoAtual)} para
> {formatarBRL(max(0, novoCentavos - pago))}.

**(c) Erro quando o valor tentado é ≤ pago** — ver §5, item 4.

Quando `pago === 0`, nenhum destes três aparece; a tela segue só com o
resumo genérico do §5.

---

## 5. Validação do campo `fValorNovo` — precedência e textos

Avaliada a cada mudança do campo, na ordem abaixo (a primeira que bater é a
que aparece em `erro={...}` do `CampoTexto`; as de baixo só são checadas se
as de cima passarem):

1. **Vazio** (`novo.trim() === ""`) — sem erro exibido; `Dica` abaixo do
   campo: *"Digite o novo valor previsto. Nada muda até você salvar."*
2. **Não numérico** (`parseValorInput(novo) === null`, cobre também
   negativo — mesma função já rejeita `n < 0`) — texto **copiado** de
   `/documento/[id]/corrigir/valor` (mesma mensagem, mesmo parser, mesma
   função): *"Não consigo ler isto como um valor em reais. Digite só
   números, com vírgula nos centavos."*
3. **Igual ao valor atual** (`novoCentavos === compromisso.valorPrevistoCentavos`)
   — *"Igual ao valor previsto atual — não há o que corrigir."*
4. **Zero** (`novoCentavos === 0`) — *"O valor previsto não pode ser zero. Se
   este agendamento deixou de ser real, use "Marcar que não vai ser pago" em
   vez de zerar o valor."* (aponta para a ação vizinha já existente, em vez
   de inventar um estado nôvo para "previsão de R$ 0").
5. **Menor ou igual ao já pago**, só quando `pago > 0` (`novoCentavos <=
   pago`) — *"Já foi pago {formatarBRL(pago)} contra este agendamento. O
   valor novo tem que ser maior que isso — do contrário o saldo zeraria sem
   explicação nenhuma."*

Quando nenhuma das cinco dispara, o campo está válido e o resumo final (§6)
aparece.

`fMotivo`: sem validação em tempo real (mesmo padrão de `cancelar/page.tsx`);
`Dica` fixa abaixo: *"Campo obrigatório. Sem efeito fiscal, mas fica
registrado por que o valor mudou."* Se por algum motivo `salvar()` for
chamado com `motivo.trim().length < 3` (defesa, o botão já vem desabilitado
nesse caso), mesmo texto de `cancelar/page.tsx`: *"Escreva o motivo —
campo obrigatório."*

---

## 6. Resumo/confirmação antes de gravar (sem modal)

Último elemento dentro de `ColunaDeDetalhe`, logo acima do `RodapeDeAcao` —
só aparece quando `fValorNovo` está válido (nenhum dos 5 erros do §5) e
`fMotivo` tem conteúdo. `Banner cor="amb" role="status"`:

> **Valor previsto: de {formatarBRL(atual)} para {formatarBRL(novoCentavos)}.**
> {se `pago > 0`: "Saldo passa de {formatarBRL(saldoAtual)} para
> {formatarBRL(saldoNovo)}. "}Sem impacto fiscal — é previsão, não custo:
> vai continuar assim até o dinheiro sair.

(A última frase reaproveita, quase literal, a `Dica` que já existe no card
"O que isso muda hoje" do detalhe do compromisso — não é texto fiscal novo,
é o mesmo texto já em produção.)

Essa frase **é** a confirmação — clicar em "Salvar" grava direto, sem
diálogo interposto, igual à decisão do `cto-obra` para esta tela.

---

## 7. Gravação — contrato funcional (nomes exatos = decisão do `cto-obra`)

Função nova em `lib/data.ts`, formato análogo a `corrigirValorDoDocumento` e
não ao par insert+update de `mudarDataPrevista` — **proposta**, a confirmar
no Gate 2: como a guarda "novo > pago" depende de outra tabela
(`compromisso_pagamento`), o ideal é uma função/RPC que valide e grave num
ato só (evita corrida: pagamento chegando entre o load e o clique em
Salvar), em vez de dois passos client-side que `mudarDataPrevista` pode se
dar ao luxo de fazer porque não tem guarda cruzada nenhuma.

Assinatura funcional exigida por esta tela (nome pode mudar):

```ts
corrigirValorPrevisto(entrada: {
  compromissoId: string;
  valorAnterior: number;  // centavos
  valorNovo: number;      // centavos
  motivo: string;
}): Promise<void>
```

- Grava, num ato só: linha de histórico (`compromisso_id`, `valor_anterior`,
  `valor_novo`, `motivo`, `registrado_em`) + `update` de
  `compromisso.valor_previsto`.
- Recusa (sem gravar nada) se `valor_novo <= Σ pagamentos vinculados` no
  momento da gravação — é a mesma regra do §5.5, reconferida no banco para
  fechar a corrida.
- Tabela de histórico proposta: `compromisso_valor_historico`, espelhando
  `compromisso_data_historico` (mesmas colunas, trocando `data_anterior`/
  `data_nova` por `valor_anterior`/`valor_novo`). Tipo em `lib/types.ts`:
  `CompromissoValorHistoricoRow`.
- Leitura: `carregarHistoricoDeValorPrevisto(compromissoId):
  Promise<CompromissoValorHistoricoRow[]>`, espelhando
  `carregarHistoricoDeData`.

**Tratamento do erro do servidor** (guarda reconferida e recusada, ou
qualquer outra falha): `catch` chama `mensagemDeErroDeGravacao(e, "no valor
previsto do agendamento")` como base; se a mensagem/código do erro for
identificável como a guarda de saldo (nome exato do `constraint`/RPC = a
confirmar com `cto-obra`/`lead-engineer` no Gate 2), sobrepor com texto
específico: *"O valor não foi salvo — um pagamento pode ter sido registrado
contra este agendamento enquanto você editava. Recarregue a tela e confira o
valor já pago antes de tentar de novo."* Sem esse mapeamento específico, cai
no texto genérico de `mensagemDeErroDeGravacao`, que já é claro o bastante
para não gravar nada e permitir nova tentativa.

---

## 8. Os 4 estados

- **Loading**: `Carregando rotulo="Carregando o agendamento"` durante o
  `useEffect` inicial (compromisso + painel + histórico); `BotaoSalvar
  ocupado` → "Salvando…" durante a gravação.
- **Vazio inicial**: `fValorNovo` e `fMotivo` vazios, nenhum resumo visível;
  se `pago > 0`, o banner (a) do §4 já aparece (ele não depende do que foi
  digitado); `Dica` "Digite o novo valor previsto. Nada muda até você
  salvar." abaixo do campo de valor.
- **Erro**: ao **carregar** → `EstadoErro` + botão de tentar de novo (mesmo
  padrão das telas irmãs); ao **gravar** → `Banner cor="red" role="alert"`
  com o texto do §7, formulário permanece preenchido (nada se perde), nada
  foi alterado no banco.
- **Sucesso**: não há tela de sucesso própria — `router.push` imediato para
  `/compromisso/[id]`, que agora mostra `Linha rotulo="Valor previsto"` com o
  valor novo e, no card de histórico (§9), a linha nova da correção.

---

## 9. Histórico no detalhe — `compromisso/[id]/page.tsx`

Novo card, no mesmo padrão do card "Histórico da data prevista" (linhas
~280-295 hoje), renderizado quando `historicoDeValor.length > 0`:

```
┌─ Histórico do valor previsto ───────────────────┐
│ 28/09/2026   R$ 4.200,00 → R$ 4.850,00           │
│   motivo: "digitei errado, a parcela é maior"    │
│                                                    │
│ O valor anterior fica registrado. Corrigir o     │
│ previsto não muda nenhum pagamento já feito.      │
└────────────────────────────────────────────────┘
```

Uma `Linha` por registro (`rotulo` = data formatada de `registrado_em`),
conteúdo `{formatarBRL(valor_anterior)} → {formatarBRL(valor_novo)}` +
o motivo em texto menor abaixo (mesmo estilo de nota que o histórico de data
não tem hoje, mas o motivo aqui existe e precisa aparecer — é o único dos
dois históricos com motivo). `Dica` de fechamento fixa, mesma ideia da que já
existe no card de data, adaptada: *"O valor anterior fica registrado.
Corrigir o previsto não muda nenhum pagamento já feito."*

Card entra na mesma ordem relativa que os outros cards de histórico — depois
do card "Pagamentos ligados", ao lado do card "Histórico da data prevista"
(ordem entre os dois não importa, nenhum dos dois disputa atenção com o
outro).

---

## Perguntas abertas (técnicas, não bloqueiam este Gate — para o `cto-obra`/Gate 2)

1. Nome exato da tabela/colunas de histórico e da função/RPC de gravação —
   propus `compromisso_valor_historico` e `corrigirValorPrevisto` por
   analogia com o par já existente (`compromisso_data_historico` /
   `mudarDataPrevista`), mas a decisão final é do `cto-obra`.
2. Confirmar se a guarda "`valor_novo` > soma paga" precisa mesmo de
   RPC atômica (minha recomendação, §7) ou se dois passos client-side bastam
   porque alguma outra camada já serializa a escrita — não tenho visibilidade
   disso.
3. Nome/forma exata do erro que o banco devolve quando a guarda recusa (para
   o `catch` da tela reconhecer e trocar por texto legível, §7) — hoje só sei
   dizer QUE precisa de um mapeamento, não qual é a mensagem/código real.

Nenhuma pergunta de fluxo, campo ou texto de tela ficou em aberto — só a
mecânica de gravação no backend.
