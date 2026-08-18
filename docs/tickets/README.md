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
grep -n '✅' docs/tickets/README.md | grep -v 'G1:.*G2:.*G3:.*G4:'
```

Achou linha? A revisão falha.

---

## Em produção — o que já está no ar

| # | Ticket | Status | Ressalva viva |
|---|---|---|---|
| 001 | Ingestão de NF/boleto | ✅ DONE com ressalvas | critério 7 (≤3 interações) transferido à US-008 |
| 002 | Autenticação | ✅ DONE com ressalva **aberta** | R2 (prova no aparelho real) **transferida ao 014**, não resolvida. **Método trocado para e-mail+senha em 18/08** — reabre a validação de tela |
| 003 | Cadastro de obra e obra ativa | ⚠️ `G1:5550d11 G2:e72bf35 G3:papel G4:papel` | **Desempatado em 18/08**: o `cto-obra` adotou a posição do `lead`. G3 fecha por **evidência transitiva** (o quality do CONTAI-002 rodou sobre árvore que já continha o 003 — hash no ticket), G4 vira **passe de papel em paralelo**. Vira ✅ só **junto com o commit de registro** |

## Fila de implementação

| Ordem | # | Ticket | P | Status | O que trava |
|---|---|---|---|---|---|
| **1** | **018** | **Vínculo pagamento↔nota** | P0 | 🔨 **`/develop` rodando** | nada — Gate 0 aprovado 18/08, Gate Fiscal fechado |
| **2** | **021** | **Corrigir documento já registrado** | P1 | 🟡 | **mock pendente (`/design`)**. Gate Fiscal fechado 18/08 em arquivo. Vira **P0** no registro da 2ª nota (R$ 40.857,14) — hoje **nenhuma tela corrige**, e o link "Corrigir na nota" já está em produção mentindo |
| 3 | 019 | Pagamento agendado (compromisso × pagamento) | P1 | 🟡 | **mock (3 estados)** + **parecer do compromisso não está em arquivo**. Vira **P0** se ele tiver registrado com data de hoje |
| 4 | 014 | Manifest de PWA + prova no aparelho | P1 | 🟢 | Gate 0 substituído por aprovação de ícone |
| 5 | 004 | Nº do documento e data de emissão | P0 | 🟡 | **mock pendente** — mesmo passe do 007 |
| 5 | 007 | CNO referenciado na NF de serviço | P0 | 🟡 | **mock pendente** + **6 pontos a reescrever** |
| 6 | 009 | Detalhe do pagamento | P0 | 🟡 | Gate 0 aprovado 16/08; **5 perguntas em aberto** |
| 7 | 005 | Headline da home (reduzido a corte) | P0 | 🟡 | **mock v5 pendente**. Decisão nº 1 fechada em 17/08: R$ 49.850 |

*O `004` e o `007` dividem a ordem 5 de propósito: mesmo formulário, mesmo passe
de mock.*

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

## Stories ainda sem ticket

`US-004` (relatórios anuais) · `US-005` (migrar planilha) · `US-006` (prestador
PF) · `US-008` (extração automática — **Gate Fiscal já fechado**, parecer de
17/08) · `US-009` a `US-012`.

**Dores sem ticket, abertas no Gate Fiscal do `CONTAI-021` (18/08)**: **D24** —
o app não sabe qual ano-calendário já foi declarado, e sem isso nem o aviso do
021 nem o da D-018.2 conseguem ser verdadeiros (mesmo detector, construir uma
vez); **D25** — documento em duplicidade não tem saída depois do registro
("marcar como duplicata de X" é anotação, não delete).

---

## Dívidas de escrituração

1. ~~**Quatro tickets decididos e não escritos**~~ — **PAGA em 18/08**: `019`,
   `016`, `017` e `006` escritos.
   **No lugar dela, a dívida que os bloqueia**: ⚠️ **dois pareceres do `contador`
   existem só em transcript** — o do **compromisso** (18/08, trava o Gate 1 do
   019) e o de **empreitada total × parcial** (10/08, trava o ramo `total` do
   016, e está em aberto há oito dias). Materializar em `docs/pareceres/`.
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
5. ⚠️ **Dois briefs de agente contradizem o `CLAUDE.md`** (aberta em 18/08 pelo
   `po`): `.claude/agents/po.md` ainda diz *"venda + 5 anos"* (corrigido em
   16/08) e `.claude/agents/designer.md` ainda diz *"majoritariamente de
   celular, no canteiro… julgado nesse cenário primeiro"* (corrigido em 18/08).
   Os briefs **reinjetam a régua velha em toda execução** — inclusive no
   `/design` do `CONTAI-021`, que é tela de **gestão**. É configuração do time:
   quem corrige é o Mateus, não um agente.
