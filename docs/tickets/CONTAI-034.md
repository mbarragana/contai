# CONTAI-034 — Campo fiscal não nasce preenchido, e o teste prova

## Roteamento do `/develop`
- **Tipo**: chore de infraestrutura de teste — **P1**
- **UI**: **não há tela nova.** Ganha `data-campo` nos controles que já existem →
  **Gate 0 não se aplica**
- **Gate Fiscal**: **sem regra nova.** O invariante já existe no `CLAUDE.md`
  (*"proibição de default em campo fiscal"*); este ticket o torna **executável**.
  O `contador` entra no Gate 2 só para conferir que nenhuma exceção nomeada no
  mapa contradiz parecer
- **Migration**: nenhuma
- **Decisão delegada pelo Mateus** ao `lead-engineer` e ao `cto-obra` em
  2026-08-23: *"faça o que o lead e o cto acharem melhor"*

## Dor de Origem

**D44**, e o que ela expõe é maior que ela.

O spec do mock do `CONTAI-019` diz: `fData` — **SEM DEFAULT — campo fiscal**.
O código **em produção** (`app/adicionar/pagamento/page.tsx:163,169`):

```
const [data, setData] = useState(hojeIso);
const [meio, setMeio] = useState<MeioPagamento>("pix");
```

**Contradiz o mock aprovado pelo Mateus, está no ar, e nenhum gate pegou.** Quem
achou foi o `po`, **cinco dias depois**, em revisão de fila — por **leitura**,
não por teste.

**O dano não é cosmético**: a data escolhe o ano-calendário **e**, por
`decidirRegistro` (`lib/fiscal/compromisso.ts:118-126`), escolhe a **entidade**
(pagamento × compromisso). O `meio` pré-selecionado torna a `RECUSA_CARTAO`
**inalcançável pela inação**.

### O diagnóstico, corrigido pelos dois agentes

O orquestrador propôs duas saídas — **(a)** o Gate 4 ler o spec campo a campo,
**(b)** o `/design` marcar linhas de rejeição e o `/tickets-req` promovê-las a
critério. **Os dois recusaram as duas**, com o mesmo fundamento:

> *"(a) e (b) são as duas variantes de copiar o spec para mais um lugar: (a)
> copia para a cabeça do revisor, (b) copia para o ticket. **Cada cópia é mais
> uma que dessincroniza.**"* — `lead-engineer`

> *"'SEM DEFAULT em campo fiscal' não é detalhe de campo nem critério de ticket:
> **já é invariante de projeto**. Invariante não se re-declara ticket a ticket —
> **se executa uma vez, para sempre**. (a) e (b) continuam sendo leitura humana,
> e leitura humana foi exatamente o que falhou."* — `cto-obra`

**Custo medido da opção (b)**: o spec do `CONTAI-003` tem **16 linhas
`SEM DEFAULT`** — viraria 16 critérios numerados a mais, e *"a validação do `po`
piora quando fica mais longa"*.

### O precedente que este ticket copia

`e2e/privilegios.spec.ts`, a resposta ao incidente de 2026-08-17. Ele compara o
**mapa real** de privilégios com o **declarado**, e **tabela nova sem `GRANT`
deixa a suíte vermelha com o nome dela**. Foi a defesa que **escalou** — a outra
(a migration `0005`) resolveu só o caso pontual.

## User Story

> **Como** time que mantém o contai, quero que **campo fiscal nascendo
> preenchido deixe a suíte vermelha com o nome do campo**, para que a proibição
> que já está escrita no `CLAUDE.md` pare de depender de alguém reler o spec — e
> para que tela nova sem classificação não nasça invisível.

## Critérios de Aceite

### 1. O elo: `data-campo`

1. [ ] Todo controle de campo fiscal recebe `data-campo="<id do mock>"` — **o id
       do spec** (`fData`, `cData`, `iTotal`…), **não** o nome do state. É o que
       amarra `fData` (spec) a `useState(hojeIso)` (código). Idioma que o repo já
       usa: `data-pendencia`, `data-agendado`, `data-trava`
2. [ ] **Fecha nos dois sentidos**: campo listado no spec **sem** `data-campo` no
       DOM → **vermelho com o nome dele**

### 2. O parser do spec — `fail-closed`, e isso é condição do `cto-obra`

3. [ ] Vitest (sem browser) parseia a seção `## Campos` dos specs em
       `design/mocks/*.md`. Gramática medida pelo `lead-engineer` nos 10 specs:
       **~45 linhas**, formato `- \`campo\` — tipo — obrigatório? — validação —
       SEM DEFAULT`, **uma por linha, zero fragmento multi-linha**
4. [ ] ⛔ **`fail-closed`**: linha sob `## Campos` que **não case com a
       gramática** → **suíte vermelha com a linha**, nunca `skip`.
       *"Parser que ignora o que não entende é a D44 de novo: o spec deriva para
       prosa e a trava se desliga em silêncio"* — `cto-obra`
5. [ ] O formato tabular do `## Campos` vira **contrato versionado**, e isso fica
       **dito dentro do próprio teste**
6. [ ] Campo com `SEM DEFAULT` no spec → **nenhuma justificativa no mapa
       salva**. É o buraco do "declare e siga": mapa escrito à mão é escape hatch
       exatamente para quem a trava existe

### 3. A enumeração comportamental — `e2e/campos-fiscais.spec.ts`

7. [ ] Nas rotas que a suíte **já abre**, enumera os controles dentro do
       `<form>` **no instante em que a tela nasce** e compara com o declarado:
       controle **não listado** → vermelho **com o nome dele**; listado como
       vazio e **com valor inicial** → vermelho
8. [ ] **Enumera as rotas do filesystem** (`app/**/page.tsx`) e exige que **toda
       rota esteja classificada**: *"tem campos fiscais: quais"* ou *"não tem"*.
       **Tela nova sem classificação → vermelho com o nome dela.** É a
       propriedade que fez o `privilegios.spec.ts` escalar
9. [ ] **Só afirma sobre controle presente naquele instante** — resolve o ruído
       de campo condicional (`cEncargos` só existe quando pago > previsto)
10. [ ] Exceções legítimas entram **nomeadas**, com proveniência, como a exceção
        do DELETE já entrou no E2E

### 4. A prova de que pega o caso real

11. [ ] **Teste provado contra a D44**: com `useState(hojeIso)` e
        `useState("pix")` restaurados, a suíte fica **vermelha nomeando `fData` e
        `meio`**; com o `CONTAI-032` aplicado, verde. Teste que não falha contra
        o defeito não prova nada — foi assim que o bug do trigger do `CONTAI-027`
        passou
12. [ ] **Falso positivo conhecido, e ele tem que passar**: `cData` do spec do
        `019` *"vem pré-preenchida com a data prevista e é editável"* — **default
        legítimo e declarado**. O cruzamento é **por linha do spec**, nunca pela
        regra geral *"todo campo fiscal nasce vazio"*

## Out of Scope

- **Consertar a D44** — é o `CONTAI-032`, que depende do `CONTAI-025`. Este
  ticket **prova** o defeito; não o conserta
- **Parser de prosa do spec** — só o `## Campos`, que é tabular. As demais seções
  são narrativa e continuam sendo lidas por gente
- **Helper `useCampoFiscal` obrigatório** — recusado pelo `lead-engineer`:
  *"invariante de tipo é elegante, mas é framework para 5 formulários e não cobre
  radio pré-marcado no JSX"*
- **Promover linha de spec a critério de ticket** (a opção b) — recusada pelos
  dois; pode ficar como higiene do `/tickets-req`, mas **sem o teste é a mesma fé
  na leitura, um nível acima**

## Gate Fiscal (Contador)

**Sem regra fiscal nova.** O invariante — *proibição de default em campo
fiscal* — já está no `CLAUDE.md` e em pareceres; este ticket o torna
**executável**.

**O que o `contador` revisa no Gate 2**: que nenhuma **exceção nomeada** no mapa
contradiga parecer. Exceção com proveniência é legítima (o `cData` do `019`);
exceção inventada para fazer a suíte passar é a D46 com outro nome.

## Pre-mortem

1. **O parser vira `fail-open` na primeira linha que ele não entende.** É a morte
   anunciada desta classe de trava, e o `cto-obra` a nomeou antes de existir. O
   critério 4 é o antídoto — e ele só sobrevive se ninguém "consertar" o teste
   afrouxando a gramática quando um spec novo divergir. **O spec é que se
   conserta.**
2. **O mapa vira escape hatch.** Alguém declara `{ default: "hoje", motivo: "…" }`
   e segue. O critério 6 fecha: `SEM DEFAULT` no spec **vence** qualquer
   justificativa.
3. **A cobertura é a dos estados que a suíte já alcança** — falso **negativo**
   assumido, igual ao `privilegios.spec.ts`, que só confere tabela que existe.
   O risco é alguém ler "verde" como "todos os campos conferidos". Fica dito no
   teste.

## Viabilidade (CTO)

- **Modelo de dados**: nenhum impacto. Sem tabela, sem `GRANT`, sem migration
- **Arquivos**: `e2e/campos-fiscais.spec.ts` (novo), o Vitest do parser (novo),
  `data-campo` nas telas com campo fiscal, e o mapa
- **Complexidade: M** — **~1 dia**, estimativa do `lead-engineer`. As duas
  metades já existem: o spec tem formato regular (medido) e o app já usa `data-*`
  como gancho
- **Dívida criada**: mais um contrato de formato a manter (`## Campos`). Mitigado
  por ser `fail-closed` — contrato que quebra em silêncio é dívida; contrato que
  quebra vermelho é teste

## Dependências

- **Bloqueado por**: nenhum
- **Bloqueia**: nenhum. Mas **quanto antes entrar, mais barato** — cada ticket de
  UI que passar sem ele é mais superfície para classificar depois

## Perguntas Abertas

- Nenhuma

## Cenário e checagem final

**Nenhum dos dois** — infraestrutura de teste, sem interface. **Teste do Canteiro
não se aplica.** Serve à **meta 1** de forma indireta e forte: campo fiscal
preenchido por default é o app **afirmando fato que ninguém conferiu**, e foi
assim que a data do pagamento — chave do regime de caixa — passou cinco dias
mentindo em produção.

**Veredito: APROVADO, P1.**
