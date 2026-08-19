# CONTAI-025 — "Paguei, mas não sei a data": o terceiro estado do desembolso

## Tipo e Prioridade
requisito novo / correção de fricção com consequência fiscal — **P1**.
Nasceu no **Gate 2 do CONTAI-010** (2026-08-19). **Os dois revisores chegaram
nele por caminhos diferentes e concordaram**, e nenhum dos dois se sentiu
autorizado a resolver: muda requisito escrito.

## A dor, e ela é uma armadilha, não um incômodo

O CONTAI-010 fixou dois estados para o desembolso do terreno:

- **`pago`** — exige data (é ela que decide o ano-calendário do custo) e
  comprovante;
- **`previsto`** — "ainda não paguei", nunca tem data, não entra em ano nenhum.

Falta o estado do meio, **e ele é o mais provável na vida real**: *"paguei,
tenho o comprovante, e não lembro/não acho o dia"*. O terreno foi comprado
antes de o app existir.

**O que o formulário faz hoje diante desse caso**: exige a data para gravar.
Palavras do `cto-obra`: *"o formulário atual, diante de quem não lembra o dia,
**convida a inventar uma data** — a violação do critério 22 pelo dedo do
usuário"*. E data inventada em campo fiscal é pior que campo vazio: **campo
vazio pergunta, campo preenchido afirma**.

## A tensão que precisa ser desempatada — e é por isso que isto é ticket

Há duas regras do projeto apontando para lados opostos, e as duas estão escritas:

| Regra | Diz |
|---|---|
| **Critério 3 do CONTAI-010** | *"cada componente com valor > 0 **exige** a sua data de pagamento. Valor sem data não é gravável."* |
| **CONTAI-019 + mock `s14`** | *"não bloqueie quando o **fato do mundo já aconteceu**"* — recusar apagaria um fato real |

**A leitura do `cto-obra`, e eu a registro sem adotá-la**: o caso cai do lado
*"não bloqueie"*, porque *"o dado não está errado, está incompleto"*. A soma que
não fecha é **dado errado** (recusar está certo); a data desconhecida **não é**.

## O que já existe pronto — e é o argumento mais forte a favor

`(estado = 'pago', data_pagamento is null)` **já é representável no schema**, e
toda a maquinaria dele **já foi construída e testada** no CONTAI-010:

- `entraEmAlgumAno` devolve `false` — não entra em ano nenhum, nem no corrente;
- `terrenoSemData` no `ResumoObra`, **fora de toda soma e fora das pendências
  fiscais** (critério 21);
- o card na home e a seção no painel do terreno, com o texto do critério 23;
- o fluxo "Informar a data" (`completarDesembolsoTerreno`) e o E2E dele.

**Hoje isso tudo é inalcançável pela interface**: sem o backfill (descartado por
autorização do Mateus em 19/08), nada produz esse estado. Está pronto e mudo.

## Critérios de Aceite (minuta — o `po` fecha)

1. [ ] Terceiro estado explícito no formulário, com rótulo que **não** seja
       ambíguo com "previsto". Algo na direção de *"Paguei — não sei a data"*.
2. [ ] **Comprovante obrigatório** neste estado. É o que o separa de um chute:
       o fato tem lastro, só falta a data. (Contraste: `previsto` não tem o que
       anexar.)
3. [ ] **Não entra em ano nenhum** enquanto a data faltar — nem no corrente.
4. [ ] Vira **pendência de complemento visível**, com o texto do critério 23 do
       CONTAI-010, e **nunca bloqueia**.
5. [ ] O critério 3 do CONTAI-010 é **reescrito**, não contornado: a regra passa
       a ser *"valor sem data não entra em ano nenhum"*, e não *"valor sem data
       não grava"*.
6. [ ] A tela **não sugere** que inventar a data é aceitável.

## Gate Fiscal
**Obrigatório, e é o coração do ticket.** Pergunta ao `contador`: registrar um
desembolso pago sem data é melhor ou pior, fiscalmente, que não registrar? A
inclinação da engenharia é *melhor* (o acervo guarda o comprovante, e a data se
recupera do extrato bancário depois), mas **quem decide é o parecer**.

## Dependências
- **Bloqueado por**: CONTAI-010 (entregue) — o estado e a maquinaria já existem.
- **Precisa de**: `po` (muda critério escrito) + `contador` (Gate Fiscal).
- **Sem mock novo**, provavelmente: é uma opção a mais num grupo de escolha que
  já existe. Confirmar com o `designer`.
