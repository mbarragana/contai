# Índice de tickets — por ordem de execução

*Atualizado em 2026-08-18. A ordem canônica é a **6ª revisão da fila**, no fim de
`../backlog.md`. Este arquivo é o mapa; o backlog é a fonte da ordem e o ticket é
a fonte do escopo.*

**Legenda**: ✅ done · 🔨 em desenvolvimento · 🟢 pronto para `/develop`
· 🟡 bloqueado por gate · 🔴 sem arquivo (só backlog)

## ⚠️ Regra de formato — ✅ sem lastro é impossível por construção

*Criada pelo `cto-obra` em 2026-08-18, depois de o ✅ do CONTAI-003 sobreviver a
**cinco revisões de fila** sem nenhum gate registrado.*

> **Um ticket só exibe ✅ se a linha citar os quatro hashes de gate —
> `G1:x G2:y G3:z G4:w`. Sem os quatro, o status é ⚠️.**

Não é questão de atenção, é questão de formato: *"verde era uma afirmação sem
referente; com hash obrigatório, a afirmação carrega a própria prova ou não se
escreve"*.

**Verificação mecânica**, a rodar no passo de revisão de fila do `/develop`:

```sh
grep -n '^|.*✅' docs/tickets/README.md | grep -v 'G1:.*G2:.*G3:.*G4:'
```

Achou linha? A revisão falha.

*Ajuste de 18/08 (`po`): a âncora `^|` foi acrescentada porque a versão anterior
casava também com a legenda e com este próprio parágrafo — o comando falhava
sempre, e um verificador que falha sempre é um verificador que ninguém roda. Só
**linha de tabela** conta.*

**Aplicado para trás em 18/08**: o `001` e o `002` foram **rebaixados a ⚠️**. Não
é dúvida sobre eles estarem no ar — é que ✅ sem os quatro hashes é afirmação sem
referente, e o critério do `cto-obra` é do projeto, vale para trás e não depende
de quem escreveu a linha.

---

## Em produção — o que já está no ar

| # | Ticket | Status | Ressalva viva |
|---|---|---|---|
| 001 | Ingestão de NF/boleto | ⚠️ **rebaixado em 18/08** (era "done") | os quatro hashes **não estão registrados**. O ticket está em produção e ninguém duvida disso — o que falta é a prova em formato auditável. Ressalva viva: critério 7 (≤3 interações) transferido à US-008 |
| 002 | Autenticação | ⚠️ **rebaixado em 18/08** (era "done") | mesmos quatro hashes ausentes. Ressalva **aberta**: R2 (prova no aparelho real) **transferida ao 014**, não resolvida. **Método trocado para e-mail+senha em 18/08** — reabre a validação de tela |
| 018 | Vínculo pagamento↔nota | ⚠️ `G1:b574316 G2:22279c0 G3:1710dc6 G4:3b9c26e` | **Quatro gates fechados e em produção** (push de 18/08, `b807901`). Fica ⚠️ e não ✅ porque os hashes acima foram **reconstruídos das mensagens de commit**, não lidos de um log de gate no ticket. Vira ✅ quando o `/develop` registrar os quatro no corpo do `CONTAI-018.md`. Corte vivo: critério 18 → `CONTAI-020` |
| 003 | Cadastro de obra e obra ativa | ⚠️ `G1:5550d11 G2:e72bf35 G3:papel G4:papel` | **Desempatado em 18/08**: o `cto-obra` adotou a posição do `lead`. G3 fecha por **evidência transitiva** (o quality do CONTAI-002 rodou sobre árvore que já continha o 003 — hash no ticket), G4 vira **passe de papel em paralelo**. Vira ✅ só **junto com o commit de registro** |

## Fila de implementação

| Ordem | # | Ticket | P | Status | O que trava |
|---|---|---|---|---|---|
| **1** | **021** | **Corrigir documento já registrado** | P1 | 🟡 | **mock pendente (`/design`)**. Gate Fiscal fechado 18/08 em arquivo. Vira **P0** no registro da 2ª nota (R$ 40.857,14) — hoje **nenhuma tela corrige**, e o link "Corrigir na nota" já está em produção mentindo |
| **2** | **019** | **Pagamento agendado (compromisso × pagamento)** | P1 | 🔨 | **G4 fechado em 18/08 após um FAIL e o conserto.** G1a `0441187` · G1b `df36b41` · G2 `50958a1` · G3 `3ec2913` · G4 `po`. O FAIL foi por **lastro documental** — a quinta resolução da diferença estava no enum e **não no parecer**; fechado pelo **ADENDO 4** (`d69a3cf`). ⚠️ **Ressalva viva: o mock v2 está DEFASADO em 4 pontos** (borda sólida no vencido, data pré-preenchida, s12 sem as cinco resoluções, sem a tela `/compromisso`) — tarefa do `designer`, **não bloqueia o PASS**, bloqueia quem for desenhar em cima. Ressalva **D28**: a `US-004` tem de chamar `podeGerarRelatorioAnual` |
| 3 | 014 | Manifest de PWA + prova no aparelho | P1 | 🟢 | Gate 0 substituído por aprovação de ícone |
| 4 | 004 | Nº do documento e data de emissão | P0 | 🟡 | **mock pendente** — mesmo passe do 007 |
| 4 | 007 | CNO referenciado na NF de serviço | P0 | 🟡 | **mock pendente** + **6 pontos a reescrever** |
| 5 | 009 | Detalhe do pagamento | P0 | 🟡 | Gate 0 aprovado 16/08; **5 perguntas em aberto** |
| 6 | 005 | Headline da home (reduzido a corte) | P0 | 🟡 | **mock v5 pendente**. Decisão nº 1 fechada em 17/08: R$ 49.850 |

*O `004` e o `007` dividem a ordem 4 de propósito: mesmo formulário, mesmo passe
de mock.*

⚠️ **`CONTAI-022` está RESERVADO e não tem arquivo** — é o **fluxo do cartão de
crédito** (dor **D26**), aberto pelo `contador` no adendo §B de 18/08: a compra
**nasce compromisso**, e o custo é do ano em que a **fatura** é paga. **P0
fiscal** — hoje essas compras não são registradas em lugar nenhum —, **bloqueado
pelo `CONTAI-019`** (precisa da entidade `compromisso`) e **precisa de mock
próprio**: o mock do 019 não tem uma única tela de cartão. A **regra fiscal já
está escrita**; falta ticket e Gate 0. O 019 fica com a **guarda** (critérios
25-27), que impede o custo de cair no mês errado enquanto isso.

⚠️ **`CONTAI-020` está RESERVADO e não tem arquivo** — é a **fila de
conciliação**, cortada do critério 18 do `CONTAI-018` (ver
`CONTAI-018.md:201`). Ele só vira ticket se a **pergunta aberta nº 2** do 018
disser que a home não basta. Não reutilizar o ID.

## Bloco de deploy — fora da fila de implementação

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| 012 | Manter o Supabase acordado | P1 | 🟢 | sem tela, sem impacto fiscal |
| 013 | Configuração de produção do login | P0 | 🟢 | **encolheu** — SMTP e template saíram com a troca para senha |
| 014 | Prova no aparelho real | P1 | 🟢 | mesmo deploy de preview do 013 |

## Depois

| # | Ticket | P | Status | Nota |
|---|---|---|---|---|
| 010 | Terreno financiado (Passo 1: captura) | P0 | 🟡 | Gate Fiscal reescrito em 17/08 — vira **lista de desembolsos**, S→M. Passo 2 espera CRC |
| 011 | Export do acervo | P0 | 🟡 | Gate 0 aprovado 16/08; **P1 do CTO** (fonte do estado) pendente |
| 016 | Tipo de empreitada na obra | P0 | 🟡 | ramo `total` **bloqueado** — o texto do contador não está em arquivo. Não exige mock |
| 017 | Lista de notas a cobrar (tela 14) | — | 🟡 | **cortado**, com condição de volta escrita. Depende de 004 + 007 |
| 006 | Estados de rede lenta/indisponível | P1 | 🟢 | sem bloqueio. ⚠️ **rodar sozinho na árvore** — toca muitos arquivos |
| 008 | Mover registro sem quebrar vínculo | P0 | 🟡 | gatilho é a US-003 |
| 015 | Captcha no login | P2 | 🟡 | mock pendente. `po` recomendou cortar; Mateus manteve como ticket |
| 022 | Cartão de crédito (compra → fatura) | P0 | 🔴 | **reservado em 18/08**, sem arquivo. Bloqueado pelo 019; regra fiscal pronta (adendo §B) |
| 023 | Tirar "regime de caixa" das 4 telas restantes | P2 | 🟢 | **criado no Gate 4 do 019** (18/08), da dor **D31**. Sem mock e sem Gate Fiscal — texto já ratificado no §F.5. **S.** Dos primeiros a ceder se a fila apertar |

## Stories ainda sem ticket

`US-004` (relatórios anuais) · `US-005` (migrar planilha) · `US-006` (prestador
PF) · `US-008` (extração automática — **Gate Fiscal já fechado**, parecer de
17/08) · `US-009` a `US-012`.

**Dores novas de 18/08, do fechamento do `CONTAI-019`**: **D26** — compra no
cartão não tem onde morar, e o comentário do código culpa uma pergunta (Q4) que
foi respondida em 08/08 → **`CONTAI-022`**; **D27** — o formulário direto recusa
gravação sem comprovante enquanto a confirmação de compromisso não recusa (dois
pesos para o mesmo fato) → **absorvida pelo `CONTAI-019`**, critérios 46-48.

**Dores sem ticket, abertas no Gate Fiscal do `CONTAI-021` (18/08)**: **D24** —
o app não sabe qual ano-calendário já foi declarado, e sem isso nem o aviso do
021 nem o da D-018.2 conseguem ser verdadeiros (mesmo detector, construir uma
vez); **D25** — documento em duplicidade não tem saída depois do registro
("marcar como duplicata de X" é anotação, não delete).

⚠️ **Colisão de ID corrigida no Gate 4 do `CONTAI-019` (18/08)**: o número
**D24** estava sendo usado por **duas** dores abertas no mesmo dia. A do
*"regime de caixa"* foi renumerada para **D31** e virou o **`CONTAI-023`**.
**D24 = ano-calendário declarado; D31 = "regime de caixa" nas telas restantes.**
ID repetido em backlog vivo destrói a rastreabilidade que o ID existe para dar —
a partir da colisão, nenhuma das duas pode ser citada em ticket sem ambiguidade.

**Dívidas do Gate 2/4 do `CONTAI-019`**: **D28** (a tela promete que o relatório
trava e **nada trava** — a `US-004` **tem de** chamar `podeGerarRelatorioAnual`),
**D29** (`getByRole(…, { name })` sem `exact` erra na direção de **aprovar**),
**D30** (`pagamento_diferenca` aceita UPDATE no valor) e **D32** (enum fiscal sem
contrapartida em `docs/pareceres/` — vai junto com a D29, e **exige antes** a
regra de o parecer citar o identificador entre crases).

---

## Dívidas de escrituração

1. ~~**Quatro tickets decididos e não escritos**~~ — **PAGA em 18/08**: `019`,
   `016`, `017` e `006` escritos.
   **A dívida que os bloqueava encolheu à metade em 18/08**: o parecer do
   **compromisso** virou arquivo (`4e0cf87` →
   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`) e **destravou o
   Gate 1 do 019**. ⚠️ **Continua só em transcript** o de **empreitada total ×
   parcial** (10/08, trava o ramo `total` do 016, aberto há oito dias).
   Materializar em `docs/pareceres/`.
2. ~~**CONTAI-003 sem Gates 3 e 4**~~ — **RECONCILIADO em 18/08**. O `cto-obra`
   cedeu à posição do `lead`, com emenda: *"Gate 3 não é pulado, é fechado por
   evidência registrada"*. Falta só o **commit de registro** dos dois passes.
   O gatilho de reabertura é único e está escrito: se o Gate 4 achar coisa que
   41 testes + produção não cobrem **e** que não cai no par 004+007.
3. **CONTAI-007 precisa de revisão de Passo 1** — seis pontos, incluindo uma
   contradição interna (declara que não precisa de mock e condiciona a própria
   aprovação a um).
4. **Decisões tomadas sob a régua velha de cenário** — as três mais afetadas,
   nomeadas pelo `cto-obra` em 18/08, **a reavaliar caso a caso**:
   1. **corte do Google Calendar** — o veto era *"não abre agenda no canteiro"*;
   2. **CONTAI-015 (captcha)** — o `po` recomendou cortar por fricção com uma
      mão; **em casa a objeção enfraquece**;
   3. **a contradição do CONTAI-007 sobre precisar de mock** — o *"não precisa,
      a tela é mínima para o polegar"* **perde o fundamento**. A revisão de
      Passo 1 do 007 deve reabrir este ponto primeiro.
5. ~~**Dois briefs de agente contradizem o `CLAUDE.md`**~~ — **PAGA em 18/08**
   pelo Mateus, no commit `f7c22e6`: `.claude/agents/po.md` não diz mais
   *"venda + 5 anos"* e `.claude/agents/designer.md` não diz mais *"no canteiro…
   julgado nesse cenário primeiro"*. **Consequência que fica registrada**: toda
   decisão anterior a `f7c22e6` foi tomada com a régua velha reinjetada no
   prompt — quando uma delas for reaberta, o argumento "não cabe com uma mão"
   não vale sozinho para tela de gestão (é o item 4 acima).
