# CONTAI-032 Tirar `data = hoje` e `meio = "pix"` do formulário de pagamento

## Tipo e Prioridade
bug — **P0** — campo fiscal preenchido por default está gravando custo falso em
silêncio (regime de caixa e roteamento pagamento×compromisso decididos por um
valor que ninguém escolheu). Doutrina do projeto: registro falso > ausência.

## Dor de Origem
D44, registrada em `docs/backlog/21-2026-08-23-setima-revisao-da-fila.md`:

> *"`app/adicionar/pagamento/page.tsx`: `:163` — `const [data, setData] =
> useState(hojeIso)`; `:169` — `const [meio, setMeio] =
> useState<MeioPagamento>("pix")`. O spec do mock do `CONTAI-019` diz, do
> mesmo campo: 'SEM DEFAULT — campo fiscal'. [...] A data do pagamento é a
> chave do regime de caixa. Um PIX de 30/12 registrado em 03/01 sem tocar no
> campo cai no ano errado, calado [...]. O meio é o irmão menor do mesmo
> problema: PIX pré-selecionado é o caminho por onde uma compra no cartão vira
> PIX sem ninguém decidir (a D26 pelo avesso)."*

Elevada pelo parecer `docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`
§1: não é ausência de custo, é custo falso gravado como afirmação do usuário.

## User Story
Como dono da obra, ao registrar um pagamento — em casa revendo lançamentos
antigos ou no canteiro logo depois de pagar —, quando abro o formulário direto
(`/adicionar/pagamento`), quero que Data e Meio cheguem em branco, para que o
que for gravado seja exatamente o que eu afirmei, nunca um valor que a tela
chutou por mim.

Cenário: **captura** — mas a proibição de default em campo fiscal é o que
**não muda** entre gestão e captura (regra permanente do `CLAUDE.md`).

## Critérios de Aceite
1. [ ] **Proposta nível 1 em `design/mocks/CONTAI-032.md` (+ `.html`) aprovada
       pelo Mateus.**
2. [ ] **Guarda-chuva de default fiscal**: Data e Meio nascem vazios; enquanto
       qualquer um dos dois estiver vazio, `decidirRegistro` não roda, nenhum
       branch (pagamento/compromisso/recusado) é decidido, e o botão Gravar
       fica desabilitado nomeando o que falta — nenhuma linha grava por chute
       de default. Cobre os dois campos e as três combinações (só Data, só
       Meio, os dois), como um único critério, por doutrina do `/tickets-req`
       ("campo fiscal não vira dezesseis critérios").
3. [ ] Preencher Data e Meio com valores reais e salvar grava **exatamente**
       o que foi digitado em `pagamento.data_pagamento` e `pagamento.meio` —
       nenhum valor intermediário aparece em tela nem no banco.
4. [ ] Escolher "Cartão" com Data preenchida dispara `RECUSA_CARTAO` /
       `RECUSA_CARTAO_ONDE_REGISTRAR` (`lib/fiscal/compromisso.ts:93-105`,
       textos literais, inalterados) e nenhuma linha grava. Primeiro E2E que
       alcança esse caminho por **escolha real do usuário nesta tela** — hoje
       a cobertura de `decidirRegistro` com `meio="cartao"` só existe isolada
       em `lib/fiscal/compromisso.test.ts`.
5. [ ] `e2e/formularios.ts` (helper de preenchimento, usado por vários specs)
       e `e2e/obra.spec.ts:372-379` passam a preencher Data e Meio
       deliberadamente antes de salvar — hoje dependem do default que este
       ticket remove. `e2e/compromisso.spec.ts` (:92-94, :132, :163) e
       `e2e/sessao-no-formulario.spec.ts` revisados pela mesma razão.
6. [ ] Dado um pagamento nascido ligado a uma nota (`?documento=`), quando o
       usuário preenche Data ou Meio (campos que hoje vêm prontos e passam a
       nascer vazios) e clica em "Corrigir na nota", a tela "Sair para
       corrigir a nota?" (critério 17, `CONTAI-021`) passa a exibir o aviso de
       perda. `temAlgoDigitado` (`page.tsx:776-789`) para de ignorar Data e
       Meio — o comentário que justifica a exclusão hoje ("nascem
       preenchidos") cita a premissa que este ticket revoga.
7. [ ] Remover `MEIO_PAGAMENTO_AVULSO` (`lib/fiscal/pagamento.ts:31`) e a
       asserção correspondente em `pagamento.test.ts` (:85, import :8) —
       comentário desatualizado ("pagamento avulso é sempre PIX") que
       contradiz a regra nova; sem uso fora do próprio teste.

## Out of Scope
- **`MEIO_PAGAMENTO_AVULSO` do fluxo de pagamento avulso ligado a nota**
  (US-007/mock v4 tela 10) — PIX ali é desenho deliberado da tela, não default
  esquecido; não confundir com este ticket (que trata do formulário direto).
- **Fluxo completo de cartão** (`CONTAI-022`) — este ticket só destrava
  `RECUSA_CARTAO`, não constrói compra→fatura.
- **Persistir "pago, sem data/meio" como estado gravável em `pagamento`** —
  decisão fiscal explícita (ver Gate Fiscal abaixo): não é isso que se
  constrói aqui.
- Qualquer mudança na lógica de `decidirRegistro` em si — o ticket muda o que
  alimenta a função (e adiciona um gate antes dela), não a função.

## Gate Fiscal (Contador) — FECHADO

Parecer de origem: `docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`
§1 e §3 (revisado — ver nota abaixo).

**Regra, condição → consequência, categoria RECUSA em todas:**

| Condição no submit | Consequência | Categoria |
|---|---|---|
| Data vazia, Meio preenchido | RECUSA — nenhuma linha grava. "Informe a data em que o pagamento saiu." (`lib/fiscal/pagamento.ts:150-154`, já existe) | RECUSA |
| Meio vazio, Data preenchida | RECUSA — nenhuma linha grava. "Informe como foi pago — PIX, boleto ou cartão." (texto novo, constante a criar no Gate 1) | RECUSA |
| Os dois vazios | RECUSA — os dois erros de campo aparecem simultâneos e independentes; **sem mensagem combinada** | RECUSA |
| Meio = cartão | `RECUSA_CARTAO` (já existente, `lib/fiscal/compromisso.ts:93-105`) — agora alcançável por escolha real, não por acidente de default | RECUSA (já existente) |

Não é AVISAR (o submit não completa, isso é para abandonar tela com dado
digitado — critério 6), não é MARCAR (pressupõe linha já gravada; aqui não dá
para nem chamar `decidirRegistro` sem os dois campos), não é REVALIDAR (não há
reconferência pós-gravação).

**Decisão fiscal explícita: NÃO existe terceiro estado "pago, sem data/meio"
gravável em `pagamento`**, ao contrário do que o `CONTAI-025` fez para
`terreno_desembolso`. Motivo: o terceiro estado do `025` nasceu de um fato
concreto (Relato 005 — comprovante preso em conta de terceiro, lançamento
histórico). Pagamento avulso a prestador é outra classe: cada linha nasce de
evento pontual, o comprovante já carrega a data, e não existe "não sei o
meio" — quem afirma o meio é o comprovante. Sem relato equivalente ao 005 para
este formulário, construir a máquina do terceiro estado aqui é engenharia
especulativa. Se o uso real produzir o mesmo padrão de abandono, isso abre
ticket futuro — não este.

**Nota sobre o parecer de 23/08**: o parecer original dizia que o `032`
"depende do `025`". Revisto no Gate Fiscal deste ticket — a dependência
pressupunha que `032` precisaria do mesmo terceiro estado do `025`; essa
premissa não se sustenta para `pagamento` (ver acima). As metades `data` e
`meio` entram no MESMO Gate 1, sem gate fiscal separando os dois — mas por
identidade de mecanismo (bloqueio de submit), não por dependência do `025`.

**Automático vs. revisão humana**: tudo é apuração automática (validação de
campo obrigatório), sem juízo de classificação. Não exige revisão humana.

## Pre-mortem
1. **O terceiro estado que a leitura ingênua do pedido presumiria — não
   existe, e reintroduzi-lo por baixo dos panos no handler de submit
   reproduziria o defeito original, só relocado.** Guarda: critério 2 e o
   Gate Fiscal acima, explícitos.
2. **`temAlgoDigitado` fica com a premissa furada e ninguém percebe em code
   review** — o comentário atual cita "nascem preenchidos" como razão de
   excluir Data/Meio do cálculo, exatamente a condição revogada. Guarda:
   critério 6, nomeado.
3. **O E2E existente é "consertado" religando o default dentro do teste**
   (preenchendo com `hojeIso()`/`"pix"` só para o vermelho sumir, sem provar
   o bloqueio). Guarda: critério 5, nomeado.

## Viabilidade (CTO)
- **Modelo de dados: NENHUM.** `data_pagamento date not null` e
  `meio meio_pagamento not null` já existem (`supabase/migrations/0001_init.sql:77-78`)
  — o banco sempre exigiu os dois; quem mentia era o formulário. Bloqueio no
  submit, antes do INSERT. Sem migration, sem GRANT.
- **Nó técnico central**: `decidirRegistro` (`page.tsx:282`) roda em todo
  render e ramifica rótulos, seção de comprovante, texto do botão e o submit.
  Com Data vazia, `"" <= hoje` é `true` — chamado ingenuamente, classificaria
  vazio como "pagamento" em silêncio. **Não alargar `decidirRegistro`**
  (função fiscal testada, critérios 25-27) — a página ganha um gate antes da
  chamada: qualquer um dos dois vazio → destino "indefinido", layout neutro.
- **Custo de componente: baixo.** `Escolha` (`app/_components/campos.tsx:84`)
  já aceita `valor: T | null` + `erro`. `meio` vira
  `useState<MeioPagamento | null>(null)`.
- **Arquivos**: `app/adicionar/pagamento/page.tsx` (defaults, gate do
  destino, `temAlgoDigitado`); `lib/fiscal/pagamento.ts` + `pagamento.test.ts`;
  `e2e/formularios.ts`; `e2e/obra.spec.ts`; `e2e/compromisso.spec.ts`;
  `e2e/sessao-no-formulario.spec.ts` (conferir se há asserção de default
  inicial). `lib/fiscal/compromisso.ts` não se toca.
- **Complexidade: M** — não pela validação (S), mas pelo estado "indefinido"
  novo e pela varredura E2E dos specs que dependiam dos defaults.
- **Dívidas criadas: nenhuma.** Paga duas: `RECUSA_CARTAO` alcançável de
  verdade, e o comentário morto de `MEIO_PAGAMENTO_AVULSO` some.

## Dependências
- Bloqueado por: nenhum (a trava do parecer de 23/08 foi revista — ver Gate
  Fiscal).
- Bloqueia: nada diretamente; destrava a leitura correta do `CONTAI-022`
  (compra no cartão deixa de virar PIX em silêncio).

## Perguntas Abertas
- Nenhuma bloqueante. Duas notas para o Gate 2, não para antes do Gate 1: o
  texto novo de Meio ainda não tem constante (`lead-engineer` cria); os
  rótulos do botão em estado parcial são texto do designer, ajustáveis sem
  reabrir o mock.

## Cenário e checagem final
**Captura.** Serve à meta 1 (nenhum pagamento sem documento hábil — aqui,
nenhum pagamento com fato fiscal chutado). Teste do Canteiro se aplica: é
exatamente o formulário de captura, ≤3 interações preservado (2 toques a mais
que o valor já exigia — Meio e Data deixam de vir prontos, mas nenhuma tela
nova nem passo novo).

**Veredito: APROVADO.**
