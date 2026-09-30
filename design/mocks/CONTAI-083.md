# CONTAI-083 — Desfazer a origem herdada de um agendamento

**Cenário: gestão** (em casa, sentado — mesma família de `/compromisso/[id]/cancelar`, `/compromisso/[id]/valor`, `/compromisso/[id]/pre-vincular`). O "Teste do Canteiro" não se aplica. 375px não é piso obrigatório, mas nenhuma das quatro telas tocadas pode quebrar nele — são recombinações de shells já em produção.

## Nível do mock: **1** (rota nova `/compromisso/[id]/origem`), com os blocos 2 a 4 em **Nível 2** (spec + texto exato) dentro deste mesmo arquivo — recombinam padrões já em produção (`/compromisso/[id]/cancelar`, `/compromisso/[id]/pre-vincular`, `/compromisso/[id]/page.tsx`), sem decisão de layout nova além da tela 1.

**Gate Fiscal consumido** (não redecidido aqui, só desenhado em cima): ADENDO 9 §M.0-M.8 de `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`. Os blocos de consequência abaixo compilam frases de M.1, M.2, M.3 e M.6 — nenhuma tese fiscal nova foi escrita por mim; onde M.5 dá a regra em prosa e não em texto de tela, o texto de UI é meu (nomeado como tal), do mesmo jeito que `PRE_VINCULO_SO_EM_ABERTO` em `lib/fiscal/compromisso.ts` já é "texto de produto, não consequência fiscal".

**Arquitetura consumida** (`cto-obra`, não redecidida): rota nova `app/(gestao)/compromisso/[id]/origem/page.tsx`, mesmo molde de `/compromisso/[id]/cancelar`; duas colunas de auditoria novas (`origem_desfeita_id`, `origem_desfeita_em`, M.4); zero criação automática de pré-vínculo no mesmo ato (M.2).

---

## 1. Tela nova — `/compromisso/[id]/origem`

### 1.1 Título e cabeçalho

`CabecalhoDaTela titulo="Desfazer a nota de origem" sub={compromisso?.favorecidoNome}` — mesmo padrão de `sub` das telas vizinhas (`cancelar`, `valor`, `data`).

### 1.2 ASCII — estado pronto (`situacao === "aberto" && documentoOrigemId !== null`)

```
┌─────────────────────────────────────────────┐
│ ‹ Agendamento                                │
│ Desfazer a nota de origem                    │
│ Ilhamix Concreto Ltda                        │
├─────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐ │
│ │ O vínculo antigo fica registrado, com a   │ │
│ │ data — nada é apagado.                     │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ┌─ Nota de origem — herdada ───────────────┐ │
│ │ NF de serviço nº 1531 · Ilhamix Concreto  │ │
│ │ Ltda                                      │ │
│ │                            R$ 30.340,00   │ │
│ │ Vinculada na criação deste agendamento.   │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ┌─ O que isso muda ─────────────────────────┐ │
│ │ Este agendamento    deixa de ligar sozinho │ │
│ │                      a esta nota na        │ │
│ │                      confirmação           │ │
│ │ Custo de aquisição   inalterado            │ │
│ │ Base de aferição      inalterada           │ │
│ │ INSS                                       │ │
│ │ Esta nota            continua em "Notas    │ │
│ │                      hábeis sem pagamento  │ │
│ │                      vinculado"            │ │
│ └───────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│           [ Desfazer a origem ]              │
│              Voltar sem salvar               │
└─────────────────────────────────────────────┘
```

Reaproveita exatamente o visual do card "Nota de origem — herdada" de `/compromisso/[id]/pre-vincular` (favorecido, tipo, número, valor, `Card className="bg-soft"`, `Passo` como rótulo do card) — a única mudança é que **o cadeado (🔒) e a frase "não pode ser removida aqui" somem**: nesta tela, ao contrário daquela, a nota pode ser desvinculada, e manter o cadeado contradiria a própria ação disponível. A frase de contexto que sobra ("Vinculada na criação deste agendamento.") fica, sem a cláusula de restrição.

### 1.3 Textos exatos

**Banner de reassurance** (`Banner cor="amb" role="status"`, mesma família do "O registro fica, com o motivo — nada é apagado." do `/cancelar` — compilado de M.2/M.4, não citação única):

> **O vínculo antigo fica registrado, com a data — nada é apagado.** Se depois
> você ainda achar que esta nota é candidata a este agendamento, você declara
> isso de novo em "Ligar notas a este agendamento" — como um ato novo, não
> como algo que volta sozinho.

**Card "O que isso muda"** (`Passo` "O que isso muda", mesmo rótulo já usado em `/compromisso/[id]/page.tsx:315`; quatro `Linha` — a primeira compila M.3, as três seguintes compilam M.1/M.6):

| rótulo | valor |
|---|---|
| Este agendamento | deixa de ligar sozinho a esta nota na confirmação |
| Custo de aquisição | inalterado |
| Base de aferição INSS | inalterada |
| Esta nota | continua em "Notas hábeis sem pagamento vinculado" |

**Botão de ação** (`BotaoSalvar variante="primary"`): **"Desfazer a origem"** (ocupado: **"Desfazendo…"**) — mesmo padrão de `cancelar` (título da tela ≠ rótulo do botão: o título nomeia a tela, o botão nomeia o ato no imperativo).

**Voltar** (`BotaoLink`): **"Voltar sem salvar"** — texto idêntico ao de `/cancelar` (mesmo par de botões, mesma ordem no `RodapeDeAcao`).

### 1.4 Os estados (são 7, não 4)

1. **Carregando** — `Carregando rotulo="Carregando o agendamento"` (idêntico a `/cancelar`).
2. **Erro ao carregar** — `EstadoErro erro={...}` + tentar de novo (idêntico a `/cancelar`).
3. **Recusa — situação não é `aberto`** (M.5): banner âmbar, sem tentar gravar, só um botão de saída. Texto de produto (não fiscal — mesma natureza de `PRE_VINCULO_SO_EM_ABERTO`):
   > Este agendamento já foi respondido — não está mais aberto. A ligação com
   > esta nota deixou de ser uma previsão e passou a fazer parte de um
   > pagamento confirmado; desfazer isso aqui não é mais possível. Nada foi
   > alterado.

   `BotaoLink href={/compromisso/${id}} variante="primary"`: **"Voltar ao agendamento"** (mesmo texto e variante da recusa equivalente em `/pre-vincular`).
4. **Recusa — sem origem para desfazer** (`situacao === "aberto" && documentoOrigemId === null`; só alcançável por URL direta, já que o CTA do §2 já nasce condicionado a `documentoOrigemId !== null`): mesmo padrão visual da recusa 3.
   > Este agendamento não tem nota de origem para desfazer — ou porque nunca
   > teve uma, ou porque ela já foi desfeita antes. Nada foi alterado.

   Mesmo `BotaoLink` "Voltar ao agendamento".
5. **Pronto** — o ASCII do §1.2: banner + card da nota + card "O que isso muda" + rodapé com os dois botões.
6. **Erro ao salvar** — `Banner cor="red" role="alert"`, com `mensagemDeErroDeGravacao(e, "no agendamento")`; nada foi gravado, o card e o botão continuam visíveis para nova tentativa (mesmo padrão do erro de `/cancelar`).
7. **Sucesso** — sem tela própria: `router.push(/compromisso/${id})`, que passa a mostrar a linha de auditoria do §4.

### 1.5 Contrato funcional (proposto, não fechado — Gate 2 decide nome final)

```ts
desfazerOrigemDoCompromisso(compromissoId: string): Promise<void>
```

Grava `origem_desfeita_id` (o `documento_origem_id` antigo) e `origem_desfeita_em` (timestamp), limpa `documento_origem_id` para `null`. **Não cria nenhuma linha em `compromisso_documento_previsto`** (M.2 — não é opção, é a única forma correta). Guardas de escrita, no servidor, iguais às da tela: `situacao === 'aberto' && documento_origem_id IS NOT NULL`.

---

## 2. CTA em `/compromisso/[id]`

**Texto**: **"Desfazer a nota de origem"** (`BotaoLink`, variante secundária — mesma dos vizinhos, mesmo texto do título da tela de destino, convenção já usada por "Ligar notas a este agendamento" → `/pre-vincular`, "Corrigir o valor previsto" → `/valor`, "Mudou a data" → `/data`).

**Posição**: dentro do bloco `data-acoes="agendamento"`, **logo depois** de "Ligar notas a este agendamento" e **antes** de "Mudou a data" — mesmo grupo ("preparar o pagamento"/"revisar a origem antes da confirmação"), pela mesma lógica de agrupamento já usada pelo CONTAI-080/073:

```
[ Registrar o pagamento ]              (ou "Ver a fatura", se origem = cartão)
[ Ligar notas a este agendamento ]
[ Desfazer a nota de origem ]           ← NOVO, condicional
[ Mudou a data ]
[ Corrigir o valor previsto ]
[ Marcar que não vai ser pago ]
```

**Guarda de exibição**: `situacao === "aberto" && documentoOrigemId !== null` — só aparece quando existe algo para desfazer. Sem guarda própria além dessa condição (mesmo padrão do CONTAI-080 — a guarda de `aberto` já é a do bloco inteiro; a de `documentoOrigemId !== null` é específica deste botão).

```tsx
{aberto && c.documentoOrigemId !== null ? (
  <BotaoLink href={`/compromisso/${c.id}/origem`}>
    Desfazer a nota de origem
  </BotaoLink>
) : null}
```

---

## 3. Frase nova em `/pre-vincular`

**Onde**: dentro do `Card` "Nota de origem — herdada" (`app/(gestao)/compromisso/[id]/pre-vincular/page.tsx`, linhas 372-376), na mesma `Dica` que hoje termina em "não pode ser removida aqui". Fica **uma frase a mais + um link**, não uma `Dica` nova.

**Texto atual** (para referência, não muda):

> Vinculada na criação deste agendamento — **não pode ser removida aqui**.
> Ela conta junto com as notas marcadas abaixo quando o pagamento for
> confirmado.

**Texto novo** (frase final acrescentada, com link — mesmo padrão de `Link ... className="underline"` dentro de `Dica` já usado em `app/(gestao)/pendencias/page.tsx`):

> Vinculada na criação deste agendamento — **não pode ser removida aqui**.
> Ela conta junto com as notas marcadas abaixo quando o pagamento for
> confirmado. Quer parar de ligar esta nota automaticamente?
> [Desfazer a origem](/compromisso/[id]/origem).

JSX equivalente:

```tsx
<Dica>
  Vinculada na criação deste agendamento —{" "}
  <strong>não pode ser removida aqui</strong>. Ela conta junto com as
  notas marcadas abaixo quando o pagamento for confirmado. Quer parar de
  ligar esta nota automaticamente?{" "}
  <Link href={`/compromisso/${c.id}/origem`} className="underline">
    Desfazer a origem
  </Link>
  .
</Dica>
```

Sem guarda própria: este bloco só renderiza quando `pronto.origem` existe (linha 357), e por essa altura da tela `situacao === "aberto"` já é garantido (a recusa por situação retorna antes, linha 295-314) — a mesma condição do CTA do §2, sem precisar repetir a checagem aqui.

---

## 4. Linha de auditoria em `/compromisso/[id]`

**Onde**: dentro do primeiro `Card` (o "card do fato", linhas 204-312 de `app/(gestao)/compromisso/[id]/page.tsx`), como uma `Linha` a mais — **não um card novo**. Entra logo depois de `Linha rotulo="Ainda falta pagar"` (linha 222-224) e antes do bloco do chip de pré-vínculo (linha 239), porque é um fato sobre o agendamento no mesmo nível dos outros (situação, forma de pagamento, data, saldo) — o chip de pré-vínculo, que vem depois, é sobre o estado *atual* dos vínculos, e a linha de auditoria é sobre um evento *passado*, então antecede.

**Condição de exibição**: `compromisso.origemDesfeitaId !== null` (campo novo, sempre lido independente de `situacao` — é rastro permanente, não desaparece se o agendamento depois for pago ou cancelado).

**Texto exato**:

> **Nota de origem desfeita em DD/MM/AAAA — Nota nº X**

Interpolação: `DD/MM/AAAA` = `formatarDataBR(compromisso.origemDesfeitaEm)`; `Nota nº X` segue a mesma convenção de identificação de documento já usada no restante do produto (`ROTULO_DO_TIPO[doc.tipo]` + `` nº ${doc.numero}`` quando há número, ou só o tipo quando não há — mesma regra de `[Nota nº X — R$ valor]` do CONTAI-080 §2) — resolvendo `origem_desfeita_id` contra `painel.documentos` (o documento pode não existir mais na lista ativa em cenários futuros de exclusão, que hoje não existem no produto — CONTAI-009 é append-only — então a resolução deve sempre achar o documento).

```tsx
<Linha rotulo="Ainda falta pagar">
  <span className="mono text-mut">~ {formatarBRL(saldo)}</span>
</Linha>

{c.origemDesfeitaId !== null ? (
  <Linha rotulo="Nota de origem">
    desfeita em {formatarDataBR(c.origemDesfeitaEm!)} —{" "}
    {rotuloCurtoDoDocumento(origemDesfeitaResolvida)}
  </Linha>
) : null}
```

(`rotuloCurtoDoDocumento` — nome proposto, não fechado; função que resolve "NF de serviço nº 1531" a partir de tipo+número, para não reescrever a interpolação em três lugares do produto. Decisão de nome é do Gate 2.)

---

## 5. Perguntas técnicas em aberto (não bloqueiam o Gate — para o `cto-obra`/Gate 2)

1. Nome final de `desfazerOrigemDoCompromisso` e de `rotuloCurtoDoDocumento` — propostos por analogia com `salvarDocumentosPrevistos`/`carregarPreVinculosDoCompromisso` do CONTAI-080.
2. Se a resolução do documento para a linha de auditoria (§4) precisa vir junto de `carregarCompromisso` (campo já resolvido) ou se a tela resolve contra `painel.documentos` como `/pre-vincular` já faz hoje para `documentoOrigemId` — decisão de camada de dados, não de tela.
3. Confirmar que a guarda de escrita do servidor (`situacao === 'aberto' && documento_origem_id IS NOT NULL`) é suficiente sozinha, ou se precisa de checagem otimista de concorrência (dois agentes tentando desfazer a mesma origem ao mesmo tempo) — mesma classe de dúvida que o CONTAI-073 §7 já deixou em aberto para outros campos do compromisso.

Nenhuma pergunta de fluxo, campo ou texto de tela ficou em aberto — as três acima são só de nome/mecânica de implementação.

---

## Campos

- SEM CAMPOS — a tela nova não introduz nenhum campo de formulário (é card de
  consequência + um botão de ação, sem input algum — M.4, sem campo de motivo,
  ao contrário de `/cancelar`), e as três telas existentes não ganham nenhum
  controle novo. As notas por tela abaixo detalham cada uma.
- NÃO É CONTROLE — seção no formato do contrato do `CONTAI-034` (`lib/design/campos-do-spec.ts`).

### `/compromisso/[id]/origem` — a tela nova

- NÃO É CONTROLE — toda a tela é leitura (nota de origem resolvida, tabela "o que isso muda") mais um único botão de ação sem parâmetro (`Desfazer a origem`). Não há default para declarar porque não há campo.

### As três telas existentes — nenhum id novo

- NÃO É CONTROLE — `/compromisso/[id]` (§2) ganha um `BotaoLink` condicional e (§4) uma `Linha` de leitura no card do fato.
- NÃO É CONTROLE — `/compromisso/[id]/pre-vincular` (§3) ganha uma frase + `Link` dentro de uma `Dica` já existente — nenhum campo, nenhum controle novo.
