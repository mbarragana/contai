# Índice de tickets — por ordem de execução

*Atualizado em 2026-08-18. A ordem canônica é a **6ª revisão da fila**, no fim de
`../backlog.md`. Este arquivo é o mapa; o backlog é a fonte da ordem e o ticket é
a fonte do escopo.*

**Legenda**: ✅ done · 🔨 em desenvolvimento · 🟢 pronto para `/develop`
· 🟡 bloqueado por gate · 🔴 sem arquivo (só backlog)

---

## Em produção — o que já está no ar

| # | Ticket | Status | Ressalva viva |
|---|---|---|---|
| 001 | Ingestão de NF/boleto | ✅ DONE com ressalvas | critério 7 (≤3 interações) transferido à US-008 |
| 002 | Autenticação | ✅ DONE com ressalva **aberta** | R2 (prova no aparelho real) **transferida ao 014**, não resolvida. **Método trocado para e-mail+senha em 18/08** — reabre a validação de tela |
| 003 | Cadastro de obra e obra ativa | ⚠️ **Gates 3 e 4 SEM REGISTRO** | schema na `main` e funcionando; falta validação de **comportamento**. O ✅ da fila era otimista |

## Fila de implementação

| Ordem | # | Ticket | P | Status | O que trava |
|---|---|---|---|---|---|
| **1** | **018** | **Vínculo pagamento↔nota** | P0 | 🔨 **`/develop` rodando** | nada — Gate 0 aprovado 18/08, Gate Fiscal fechado |
| 2 | 019 | Pagamento agendado (previsto × executado) | P1 | 🔴 **sem arquivo** | escrever o ticket; reescreve a US-002 |
| 3 | 014 | Manifest de PWA + prova no aparelho | P1 | 🟢 | Gate 0 substituído por aprovação de ícone |
| 4 | 004 | Nº do documento e data de emissão | P0 | 🟡 | **mock pendente** — mesmo passe do 007 |
| 4 | 007 | CNO referenciado na NF de serviço | P0 | 🟡 | **mock pendente** + **6 pontos a reescrever** |
| 5 | 009 | Detalhe do pagamento | P0 | 🟡 | Gate 0 aprovado 16/08; **5 perguntas em aberto** |
| 6 | 005 | Headline da home (reduzido a corte) | P0 | 🟡 | **mock v5 pendente**. Decisão nº 1 fechada em 17/08: R$ 49.850 |

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
| 016 | Tipo de empreitada na obra | P0 | 🔴 **sem arquivo** | decidido pelo `po` em 17/08 |
| 017 | Lista de notas a cobrar (tela 14) | — | 🔴 **sem arquivo** | cortado do 007 pelo `po` |
| 006 | Estados de rede lenta/indisponível | P1 | 🔴 **sem arquivo** | — |
| 008 | Mover registro sem quebrar vínculo | P0 | 🟡 | gatilho é a US-003 |
| 015 | Captcha no login | P2 | 🟡 | mock pendente. `po` recomendou cortar; Mateus manteve como ticket |

## Stories ainda sem ticket

`US-004` (relatórios anuais) · `US-005` (migrar planilha) · `US-006` (prestador
PF) · `US-008` (extração automática — **Gate Fiscal já fechado**, parecer de
17/08) · `US-009` a `US-012`.

---

## Dívidas de escrituração

1. **Quatro tickets decididos e não escritos**: `019`, `016`, `017`, `006`.
2. **CONTAI-003 sem Gates 3 e 4.** O `cto-obra` decidiu fechá-los antes do par
   004+007; o `lead-engineer` discordou e propôs Gate 4 como passe de papel em
   paralelo. **Não reconciliado.**
3. **CONTAI-007 precisa de revisão de Passo 1** — seis pontos, incluindo uma
   contradição interna (declara que não precisa de mock e condiciona a própria
   aprovação a um).
4. **Decisões de 17–18/08 tomadas sob a premissa errada de cenário de uso**
   ("uma mão, com pressa" como veto) — reavaliar **caso a caso**. Primeira
   candidata: o corte do Google Calendar.
