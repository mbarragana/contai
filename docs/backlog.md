# Backlog — contai

Backlog vivo. Dores extraídas dos relatos do Mateus, stories priorizadas
(P0 fiscal / P1 fricção / P2 conveniência), perguntas abertas e cortes.

**Este arquivo é o ÍNDICE. O conteúdo está em `docs/backlog/`, uma entrada por
data.** O diário chegou a 150 KB e toda leitura integral custava ~38k tokens —
quebrado em 2026-08-22, sem reescrever uma linha do conteúdo: só movido.

## Como ler isto sem queimar contexto

1. Este índice (≈5 KB) diz onde está cada coisa
2. `grep -rn '<termo>' docs/backlog/` acha a entrada
3. Abra **só** o arquivo da entrada

Nunca leia `docs/backlog/` inteiro — a soma continua sendo 150 KB.

Ticket e parecer antigos citam `docs/backlog.md` com o nome da seção (*"seção de perguntas respondidas"*, *"5ª revisão da fila"*, *"Gates 2 a 4 do
CONTAI-021"*). Esses nomes continuam existindo **literalmente** nas entradas: `grep -rn '<nome da seção>' docs/backlog/` resolve a citação. Nenhum registro
histórico foi reescrito na quebra.

---
## DECISÕES PENDENTES DO MATEUS (Gate 4 do CONTAI-001, 2026-08-08)

*Bloco destacado: nada aqui avança sem resposta explícita do Mateus.*

1. ~~**Headline "Em pendência"**~~ — **DECIDIDA em 2026-08-17: R$ 49.850.**
   Fechada pelo **contador + PO**, sob a delegação do Mateus do mesmo dia
   (decisão técnica é do Lead+CTO; fiscal e de produto, do Contador+PO — ele
   decide só mock, fatos que só ele sabe, ações fora do app e push).
   O contador **não carimbou nem os 92.850 nem os 47.850**; carimbou a
   recomendação do PO. Parecer completo em
   `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, Parte 2, com os
   textos de tela prontos e três ressalvas bloqueantes — sendo a maior a R5: o
   *"Custo confirmado R$ 0,00"* ao lado do headline é **estrutural**, e como
   está a home afirma que 100% do que foi gasto está em risco.
   **O `CONTAI-005` está destravado** (ver `docs/tickets/CONTAI-005.md`,
   alternativa (a)). Texto original da pendência, preservado para histórico:

   **Headline "Em pendência" — recomendação do PO: nem 92.850, nem 47.850.**
   Os R$ 47.850 do mock são aritmética de antes do card "pago sem nota"
   existir; os R$ 92.850 somam quatro moedas diferentes (perda de custo,
   conta a pagar e base de INSS). Proposta: headline = **"Custo em risco no
   IR"** = quarentena + pago sem nota (R$ 49.850 no cenário do mock);
   exposição INSS em linha separada expressa **em base** ("R$ 18.000 de NF de
   serviço sem retenção"), sem reais perdidos até o contador fechar o cálculo
   na US-004; boleto sai do headline e fica só como card (o lugar dele é a
   fila "a pagar" da US-002). Efeito colateral: some o double-count apontado
   pelo cto-obra. → **CONTAI-005 [P0]**. Raciocínio completo no Gate 4 do
   ticket CONTAI-001.
2. **Divergências menores do mock — recomendação do PO por item** (detalhe no
   Gate 4 do ticket):
   - linha de imposto da tela 6 → **ratificar a omissão**; volta com a
     fórmula do contador ("até R$ X", com disclaimer);
   - "Destinatário: AJE" omitido → **backlog, anexado à US-008** (a extração
     entrega de graça; perguntar hoje custa mais um campo no caminho ruim);
   - botão "Anotar: falar com o empreiteiro" → **cortar em definitivo**
     (comunicação com empreiteiro é escopo declarado fora do produto);
   - botão "Pedir nota corrigida" → **backlog P2 com trava**: só deep-link de
     WhatsApp com texto pronto, zero estado no sistema;
   - FAB "+ Adicionar" → **ratificar e corrigir o mock** (o mock é que
     ficou com o rótulo da v2);
   - tela 8 parametrizada por porta → **ratificar**;
   - "Favorecido (recente)" → **backlog P1**, primeiro da fila depois do
     login (não é conveniência: CNPJ digitado errado parte a agregação
     CPF-por-CPF da US-004 em dois).
3. ~~**Priorização da fila proposta pelo PO**~~ — **OBSOLETA** (2026-08-09).
   Valia enquanto o produto era de uma obra só. Vale a **"Fila revista — 3ª
   revisão"**, no Gate 2 do CONTAI-003 (fim deste arquivo). As decisões 1 e 2
   acima seguem abertas.

### ⚠️ Q14 — A PERGUNTA MAIS CARA EM ABERTO (acrescentada em 2026-08-10)

> **"A obra sem CNO é empreitada TOTAL — a construtora fornece o material e
> assina a ART da obra inteira?"**

Custa uma frase de resposta e decide **de quem é a obrigação do CNO**. Se for
empreitada total, o CNO é **da construtora**, e o texto que o CONTAI-003 põe em
produção **cobra do Mateus uma obrigação de terceiro** — mandando a pessoa
errada agir e deixando a certa parada, na **única janela de força que existe**
(antes de liberar a próxima parcela; depois do último pagamento não há mais o
que segurar).

- **Não bloqueia** o CONTAI-003 nem a implementação
- **Bloqueia o texto em tela**, junto de uma 2ª condição cumulativa:
  **confirmar na IN vigente de quem é o titular do CNO em empreitada total**
- O `contador` **já redigiu o texto alternativo completo** para o caso de
  empreitada total (título, frase do prazo, próximo passo, rótulo do campo de
  CNO). Ele saiu no review fiscal do Gate 2 e **ainda não está em arquivo** —
  materializar em `docs/pareceres/2026-08-09-obra-sem-cno.md` antes de usar
- **Também muda a ação nº 0 da fila** (registrar o CNO no e-CAC): se for
  empreitada total, essa ação **troca de dono**

---

---

## Estado vigente — o que vale hoje

| O que | Onde |
|---|---|
| **Ordem de execução e status dos tickets** | **`docs/tickets/README.md`** — é o dono. Não mora aqui |
| Decisões travando avanço | bloco **DECISÕES PENDENTES DO MATEUS**, acima neste arquivo |
| Última adjudicação fiscal | `docs/backlog/15-2026-08-21-adjudicacao-fiscal-contai-027.md` |
| Último Gate 4 fechado | `docs/backlog/28-2026-08-24-gate4-contai-036.md` — `CONTAI-036`, **ENTREGUE e COMMITADO** (`2240931`). `CONTAI-004` entregue no mesmo dia, antes (`05cb1e7`). `docs/tickets/README.md` tem linha própria dos dois |
| Ticket novo, 2026-09-21 | `docs/backlog/43-2026-09-21-convergencia-home-desktop.md` → **`CONTAI-039`** (P1, layout desktop da home). Único item da fila; bloqueado por `/design` antes do Gate 1 |
| Doutrina revertida, 2026-09-21 | `docs/backlog/45-2026-09-21-cenario-desktop-first-contai-039.md` — Mateus: *"o uso atualmente é 100% desktop"* / *"pode quebrar"* o mobile. **"375px é o piso, não o alvo" fica obsoleta** (`CLAUDE.md`, "Cenários de uso — 2ª correção"). Revisita a rejeição do Conceito 1 (tabela) no `CONTAI-039`; novo desenho é trabalho paralelo do `designer`. 3 perguntas abertas, sem resposta ainda |
| Mock aprovado + 5 decisões + reconciliação técnica, 2026-09-21 | `docs/backlog/46-2026-09-21-cinco-decisoes-desktop-shell-contai-040-042.md` — `design/mocks/desktop-shell-v1.html`/`.md` aprovado ("100% better"), substitui o `CONTAI-039`. As 5 perguntas do spec fechadas pelo `po`; vira **`CONTAI-040`** (shell+dashboard), **`CONTAI-041`** (Despesas), **`CONTAI-042`** (Pendências unificadas). **Adendo do mesmo dia**: achado do `cto-obra` (18 famílias de pendência, não 7) inverte a ordem para **`042` → `040` → `041`** e fecha a arquitetura mobile×desktop (route groups `(gestao)`/`(captura)`) |
| Gate 1 do `CONTAI-040`, 4 decisões do `po`, 2026-09-21 | `docs/backlog/48-2026-09-21-gate1-decisoes-contai-040.md` — seletor de ano fica texto (não controle) por esta rodada, **ticket futuro não numerado** "seletor de ano sincronizado dashboard + /pendencias" (P1); painel de pendências usa cards completos, mock a corrigir; `/despesas` stub + painel "Notas hábeis sem pagamento" mantido, com ressalva de proveniência (comentário de código não é decisão registrada); texto "na fila de pendências" confirmado sem CRC |
| Quatro tickets novos, 2026-09-21 | `docs/backlog/50-2026-09-21-migracao-detalhe-para-shell.md` — dívida nomeada pelo próprio `app/(captura)/layout.tsx` desde o `CONTAI-040` vira **`CONTAI-043`** (Documento), **`CONTAI-044`** (Pagamento+Fatura), **`CONTAI-045`** (Compromisso+Pendências), **`CONTAI-046`** (Obras+Terreno) — todos P1, ordem sugerida 043→044→045→046, nenhum se bloqueia formalmente. Achado do `cto-obra` (coluna ~560px, não full-width, do Gate 2 do `039`) formalizado pela primeira vez como critério de aceite. **Nenhum tem Gate 0 fechado** — bloqueados pelo spec "detalhe dentro do shell" que o `designer` está desenhando em paralelo. `/entrar` e `/obras/nova` ficam fora em definitivo; `/conta` fica fora desta rodada, candidata a ticket próprio futuro |
| Pergunta aberta respondida + dois tickets novos, 2026-09-22 | `docs/backlog/58-2026-09-22-captura-tela-larga-contai-047-048.md` — o Mateus respondeu a pergunta 2 do `45-…`: a permissão de tela larga vale **também** para captura (`/adicionar/*`), não só gestão (`CLAUDE.md`, bloco "RESPONDIDA em 2026-09-22"). Consulta técnica ao `cto-obra` **rejeita** mover essas rotas para `(gestao)` (traria chrome de gestão para o canteiro, duplicaria "obra ativa") e recomenda casca larga própria dentro de `(captura)` — vira **`CONTAI-047`** (P1, reflow de layout, zero mudança de campo/validação). Achado à parte, promovido a ticket próprio não bloqueante: **`CONTAI-048`** (anexo visível ao lado do formulário em `/adicionar/documento`, feature nova, sem mock ainda). Nenhum dos dois tem Gate 0 fechado |
| Gate 0 fechado + 5 decisões, 2026-09-22 | `docs/backlog/59-2026-09-22-decisao-po-mock-captura-desktop.md` — o `designer` publicou `design/mocks/captura-no-desktop-v1.md`/`.html` em paralelo ao `047`/`048`; o `po` reconciliou os dois. O rail do mock (miniatura 52×52 + resumo somente-leitura) é reflow, não a feature do `048` (render legível do documento) — entra no `047` (critério 1a), `048` continua sem Gate 0. Takeover de tela cheia confirmado com o `cto-obra`: navegação normal entre route groups irmãos, zero código novo. Largura do grupo sobe de 720px (sugestão original) para **~900px**, por causa do rail. **D68** nova (inconsistência pré-existente "Passo 2 de 3"/"Passo 3 de 3"). Rail não se estende a `pagamento`/`compra-cartao` por ora. **`CONTAI-047` sai de "bloqueado por Gate 0" e entra pronto para `/develop`** |
| Gate 4 fechado, `CONTAI-047` entregue, 2026-09-23 | `docs/backlog/60-2026-09-23-contai-047-entregue.md` — 11/11 critérios PASS. Casca larga do grupo `(captura)` (`larga:max-w-[940px]`, 880px), rail de `documento/page.tsx` (anexo/preview/extração + resumo somente-leitura), `CamposCurtos` nos três formulários com pergunta fiscal preservada em coluna única. Quatro divergências do mock/critério literal julgadas no Gate 2 e fechadas como decisões (grid nova no hub, resumo do rail oculto abaixo do piso, stepper decorativo convivendo com "Passo X de Y", ajuste de formatação no `.md` do spec). `CONTAI-048` continua fora da fila, sem Gate 0 |
| Duas lacunas fechadas pelo `po`, 2026-09-23 | `docs/backlog/61-2026-09-23-po-fecha-lacunas-contai-011-048.md` — **`CONTAI-011`**: "P1/P2/P3" investigadas — P1 (fonte de dados do export) já resolvida pelo `cto-obra` (Decisão 4); **P2 e P3 nunca existiram** (numeração corrigida no cabeçalho do ticket); M2 (semanal) confirmada, M3 reavaliada como não-bloqueante. `CONTAI-048`: consulta ao `cto-obra` sobre PDF mobile respondida — achado real é o `<object>` travar na 1ª página em iOS/WebKit (silencioso, não é o fallback de download que o `designer` temia); correção por tipo de entrada incorporada ao critério 3 (PDF em touch abre em nova aba). Gate 0 fechado. **PRONTO PARA `/develop`**, com validação manual em iPhone pendente para o Gate 4. ⚠️ **`CONTAI-011` foi fatiado no dia seguinte — ver linha abaixo, esta entrada fica como registro histórico do que se sabia até então** |
| `CONTAI-011` fatiado em três, 2026-09-23 | `docs/backlog/62-2026-09-23-fatiamento-contai-011.md` — o `lead-engineer` tentou o Gate 1 real e devolveu sem código, com dois achados de fundo. **Achado 1 (arquitetura, `cto-obra`)**: a Vercel não tinha credencial para gerar o dossiê sob demanda — resolvido com fila `export_solicitacao` no Postgres + `workflow_dispatch` sem parâmetro, acordado por um PAT de escopo mínimo (Decisão 2b: só pode morar na Vercel credencial que não lê dado e não aceita input). **Achado 2 (fiscal, `contador`)**: "vincular" um objeto órfão só é possível hoje quando o documento-alvo ainda não tem arquivo (migration `0014`); confirmado como restrição correta, "vincular" vira duas rotas (documento sem arquivo / anexo adicional via `documento_anexo`), e os campos do 3º destino da triagem (documento sem gasto) definidos, com ITBI/escritura excluídos dessa categoria. Resultado: **`CONTAI-011` (011-A)** reduzido à rotina periódica, **pronto para `/develop`**; **`CONTAI-049` (011-B)** triagem completa do órfão, destravada mas falta mock+sequenciamento; **`CONTAI-050` (011-C)** dossiê sob demanda, destravado mas falta decisão fiscal residual (R6) |
| Tickets criados, `CONTAI-085`/`086`/`087`, P0/P0/P1, 2026-10-05 | `docs/backlog/101-2026-10-05-correcao-nota-substituida-com-retencao-nova.md` — nota PerfuraTec 261 cancelada e substituída pela 263 (mesma obra, mesmo valor, "Situação Tributária" muda para "Retenção" de ISS; parecer `docs/pareceres/2026-10-02-iss-retido-floripa-perfuratec-nfse263.md`). `/tickets-req` completo, 3 tickets (decisão do `po`: US1/US2 não são igualmente pré-aprovadas — só `numero`/`serie` (**D89**) tem parecer de 2026-08-18 cobrindo; `retencaoNaNota` (**D90**) é posterior, Gate Fiscal novo). `contador` fechou os 3: `CONTAI-085` ratifica o parecer existente; `CONTAI-086` define anexo condicional por motivo (recusa se `emitente_corrigiu_a_nota`, revalida se não) e ratifica DELETE+snapshot em `revisao` pra reverter destacada→nenhuma (cercado à RPC, nunca rota genérica); `CONTAI-087` mesma lógica condicional pra linha de retenção tardia. `cto-obra` corrigiu 2 premissas (documento_retencao NÃO é append-only, é deletável por desenho da 0017; `vinculo.ts`/`resumo.ts` leem `d.retencoes` sem olhar o gate) e decidiu que `086`+`087` são o MESMO Gate 1 (migration `0028` compartilhada). `085` é independente, complexidade S, vai primeiro. `designer`: nível 1+2, `design/mocks/CONTAI-085.md` e `CONTAI-086.md` (cobre 087). **Prontos para `/develop`.** Detalhe: `docs/tickets/CONTAI-085.md`, `086.md`, `087.md` |
| Relato + consulta arquitetural + dois tickets novos, 2026-09-26 | `docs/backlog/78-2026-09-26-cartao-nao-herda-documento.md` — Mateus: troca de "Como foi pago" para Cartão em `/adicionar/pagamento?documento=<id>` redireciona para `/adicionar/compra-cartao` **vazia**. Hipótese inicial (buraco de schema em `fatura_desembolso`) **rejeitada** pelo `cto-obra`: `compromisso.documento_origem_id` já é genérico e já é gravado pela RPC de cartão desde a migration `0007`/`0013` — é lacuna de UI, zero migration. Achado mais sério do `cto-obra`: o campo é **write-only** em todo o app (D79 nova) — nunca propagado para `pagamento_documento` na quitação, nem no cartão nem no PIX/boleto agendado. `contador` liberou a replicação automática na quitação como segura (`docs/pareceres/2026-09-26-replicar-vinculo-documento-quitacao.md`: não é heurística, é persistir afirmação humana já feita). Vira **`CONTAI-064`** (P1, S, herança na tela de captura, zero migration) e **`CONTAI-065`** (P1, M, propagar o vínculo na quitação, com migration) — independentes entre si. **`064` fechou Gate 0** no mesmo dia (`design/mocks/CONTAI-064.md`, nível 2); achado extra do `designer` (link "Corrigir na nota" sem retorno para `compra-cartao`) virou critério 9, confirmação de escopo pendente do `cto-obra` no Gate 2. **Os dois PRONTOS PARA `/develop`** |
| **Export do acervo POSTO EM ESPERA, 2026-09-23** | `docs/backlog/63-2026-09-23-export-acervo-em-espera.md` — o `011-A` chegou a rodar o Gate 1 até o fim (DONE, 1012 unitários + 292 E2E verdes, **não commitado**) quando o Mateus achou uma lacuna que nenhum agente tinha visto: o desenho inteiro (011/049/050) assume destino único (Drive do Mateus, credencial central) e não escala para produto multiusuário — cada usuário precisaria conectar o **próprio** Drive. **`CONTAI-011`, `CONTAI-049` e `CONTAI-050` saem da fila ativa** até essa lacuna de requisito ser resolvida, e só voltam **depois que o fluxo comum de despesas/apuração de custo estiver estável**. Nada commitado, nenhuma migration aplicada, Gate 2 não se inicia |
| Ticket novo, 2026-09-23 | `docs/backlog/64-2026-09-23-contai-051-lacuna-obras-shell.md` — auditoria do coordenador achou `/obras` ("Trocar obra") de fora da migração desktop (`040`/`043`-`046`/`047`): sem `ColunaDeDetalhe`/`CabecalhoDaTela`, sem teto de largura na `ListaDeEscolha`, dois `max-w-[430px]` soltos nos botões — mesma inconsistência do Conceito 1 rejeitado no `CONTAI-039`. Vira **`CONTAI-051`** (P1, reflow puro). **`ColunaDeDetalhe`/`CabecalhoDaTela` não se aplicam** — é lista de nível superior (irmã de `/despesas`/`/pendencias`), não detalhe de registro. **Gate 0 fechado por reaproveitamento**, sem acionar o `designer`; entra pronto para `/develop`, posição 2 da fila (depois do `048`) |
| Gate 4 fechado, `CONTAI-048` entregue, 2026-09-23 | `docs/backlog/65-2026-09-23-contai-048-entregue.md` — 5/5 critérios PASS. Lightbox sob demanda (`app/_components/anexo-preview.tsx` + `lib/preview-anexo.ts`) no rail de `documento/page.tsx`: miniatura 120px inline para imagem, `<object>` no Lightbox para PDF em tela larga, link `<a target="_blank">` para PDF em tela estreita (correção do `cto-obra`, evita degradação silenciosa no Safari iOS). Zero efeito em campo fiscal, sanity check do `contador`. **Dívida nomeada D69**: validação em iPhone real + macOS Safari com PDF de ≥2 páginas continua pendente — nem CI nem a validação manual em Chrome desktop provam o comportamento nativo do Safari iOS, que é o risco que o critério 3 existe para corrigir. Fechado como DONE com a dívida registrada, não como "tudo pronto". `CONTAI-051` fica sozinho na fila ativa |
| Gate 4 fechado, `CONTAI-051` entregue, 2026-09-23 | `docs/backlog/66-2026-09-23-contai-051-entregue.md` — 6/6 critérios PASS. `ColunaDeEscolha` local em `obras/page.tsx` (`max-w-[640px]`, mesma medida de `ColunaDeDetalhe`, reaproveitada como número) envolve os 4 estados; os dois `max-w-[430px]` soltos saíram, botões passam a viver na mesma coluna da lista. `ListaDeEscolha` (`app/_components/obra.tsx`) e `shell.tsx` intocados — confirmado por diff. Gate 2 técnico teve 1 rodada (docblock com erro factual sobre o destino do clique, corrigido, sem mudança de código/teste). Sem migration. **Fila de implementação fica vazia** |
| Incidente de extração Gemini, 3 rodadas, 2026-09-24 | `docs/backlog/67-2026-09-24-incidente-extracao-gemini.md` — "erro frequente no parse da nota". R1: causa real era `maxOutputTokens` como teto total (thinking + JSON), não o que o texto colado do Google sugeria (API errada, endpoint errado); fix inicial `thinkingLevel: "minimal"` (commit `6bc0e66`). R2: "minimal" quebrou em produção com 400 — `gemini-flash-latest` (fallback do código, resolve para `gemini-3.8-flash`) rejeita esse nível; corrigido para `"low"`, testado contra API real + PDF real + navegador (commit `4be9107`). Achado lateral: conta no tier gratuito, 5 req/min. R3: retry automático (429 + qualquer 5xx + falha de rede, até 3 tentativas, backoff ~4s) — não resolve indisponibilidade prolongada (Mateus viu o mesmo 503 20 min depois), só o blip comum. **D70** nova (fetch sem timeout). Fallback (Claude API, Groq, extração determinística de texto embutido em PDF) avaliado, nenhum implementado — Groq só tem visão para imagem, não PDF direto |
| Ticket novo, decisões técnicas fechadas, 2026-09-24 | `docs/backlog/68-2026-09-24-decisoes-tecnicas-contai-052.md` — decidido em conversa direta do Mateus com o coordenador, seguindo a ideia já cogitada no fim do `67-…`: extrair texto embutido do PDF localmente (sem API), e se suficiente mandar para a **Groq** (cota separada da do Gemini, tira a fatia do caminho no limite de 5 req/min); se insuficiente (scan/foto), cai no caminho de hoje (Gemini + retry). Vira **`CONTAI-052`** (P1, sem `/design` — zero mudança de UX). `cto-obra` fechou 7 decisões técnicas antes do Gate 1 (biblioteca `unpdf`; estágio ortogonal em `provider.ts`, não `case` novo; heurística de 3 testes + verificação campo-contra-fonte para não mandar PDF-imagem como se fosse texto legível; `confianca` com critério por modalidade; retry/timeout extraído e reaproveitado, **fecha a D70**; env `GROQ_API_KEY`/`GROQ_MODEL`/`EXTRACAO_TEXTO`, sem migration). `contador` sanity check **APROVADO** sem parecer formal — contrato `ExtracaoDocumento` intocado, nenhum campo fiscal tocado por nenhum provedor; ressalva de privacidade/LGPD (texto puro para provedor americano) separada como não-fiscal. **Fora de escopo explícito**: Groq como fallback de visão (só imagem, não PDF), aceitar JPEG/HEIC direto na rota, agendador de deadline total, Claude API como provedor de visão. **Pronto para `/develop`** |
| Gate 4 fechado, `CONTAI-052` entregue, 2026-09-25 | `docs/backlog/69-2026-09-25-contai-052-entregue.md` — 9/9 critérios PASS. Estágio ortogonal `unpdf` → Groq (texto) → Gemini (visão) em `lib/extracao/provider.ts`; retry/timeout extraído para `lib/extracao/retry.ts`, **D70 resolvida** (`AbortSignal.timeout()` + `maxDuration=60`). Gate 2 técnico (`cto-obra`) testou `unpdf` real e achou bug bloqueante (`Buffer` rejeitado pelo PDF.js interno) mais dois não pedidos (`Number("")` virando R$ 0,00 fiscal inventado; separador de milhar quebrando 1000x) — todos corrigidos antes de produção. 90/90 testes em `lib/extracao`, `npm run build` verde com `unpdf` em `dependencies`. **D71** (Groq nunca testado contra API real) e **D72** (heurística de texto calibrada só com fixtures sintéticas) nomeadas, não bloqueantes. **Fila de implementação volta a vazia** |
| Incidente em produção, D71 materializada e resolvida, 2026-09-25 | `docs/backlog/70-2026-09-25-incidente-groq-modelo-descontinuado.md` — chave Groq configurada na Vercel, primeira exercitação real caiu 404: `llama-3.3-70b-versatile` (default hardcoded) tinha sido **descontinuado pela Groq** desde o Gate 1 do `CONTAI-052`, sem nenhum modelo Llama de texto restando na conta. Confirmado por chamada real (`curl`), não suposição. Fix: default trocado para `openai/gpt-oss-120b` + `reasoning_effort: "low"` (evita a mesma armadilha de "raciocínio consome o teto" do incidente Gemini de 24/09), verificado com texto de nota real antes de commitar. **D73** nova (nome de modelo de provedor externo sem verificação automática) |
| Relato novo, duas stories P1, 2026-09-25 | `docs/backlog/71-2026-09-25-retencao-na-captura-e-extracao-deterministica.md` — Mateus pediu que, quando o gate de retenção = "destacada", o repeater completo (hoje só em `/documento/[id]`, `CONTAI-038`) apareça já em `/adicionar/documento`, e que a extração ajude a detectar retenção lendo o PDF (exemplo: NFS-e municipal com campo "ISSRF" estruturado). Vira **US-A** (repeater na captura em tela larga, aproveitando a casca do `CONTAI-047`; Teste do Canteiro continua valendo em tela estreita) e **US-B** (extração sugere só `rotulo_literal`/`valor` da linha, nunca antes do gate). Consulta ao `contador`: **gate `retencao_na_nota` nunca pode ser sugerido pela extração, nem para layout estruturado** — mesma classe de `notaNoCpf`, sem exceção por padrão de nota. Nenhuma migration. Sem Gate 0 (US-A precisa de `/design`); "excedente da nota não fecha sozinho" citado só como contexto, sem story |
| Gate 4 fechado, `CONTAI-056` entregue, 2026-09-25 | `docs/tickets/CONTAI-056.md` — 8/8 critérios PASS. `alocarCusto` passou a somar linha de retenção confirmada (`e_desconto_efetivo=true` + `quem_recolhe ∈ {"empresa","nao_sei"}`) como perna de pagamento, data-efeito do pagamento vinculado mais antigo, sem migration. Gate 2 técnico aprovou com **D77** nomeada (borda não bloqueante: duas notas com retenção + pagamento compartilhado). Gate 2 fiscal pediu correção pontual de texto (copiado do parecer, não parafraseado) — corrigida. Verificação manual real: nota de R$1.000 com retenção de R$50 no stack local, tela mudou de "nota ainda não paga" para "Custo comprovado: R$1.000,00". `afericao.ts` confirmado intocado. 1040 unitários + 300 E2E verdes |
| Bug P0 achado e ticket aberto, 2026-09-25 | `docs/tickets/CONTAI-056.md` — o Mateus flagrou contradição entre o que o `contador` disse na sessão ("custo de aquisição = bruto da nota") e a tela de um documento real dele mostrando "Excedente — nota ainda não paga" mesmo com retenção confirmada e `quem_recolhe` resolvido. Auditoria de `lib/fiscal/vinculo.ts` confirmou: `alocarCusto` nunca soma `documento_retencao` como custo, mesmo com `e_desconto_efetivo=true` — subestima custo de aquisição, infla ganho de capital futuro. Duas rodadas de Gate Fiscal (ADENDO 2 + ADENDO 3 em `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`): linha soma como perna de pagamento só se `quem_recolhe ∈ {"empresa","nao_sei"}` (nunca "eu", que usa guia real); data-efeito = pagamento vinculado mais antigo, sem migration. `cto-obra` confirmou aferição SERO isolada (`afericao.ts` não importa `vinculo.ts`). **Pronto para `/develop`, primeiro da fila por ser P0** |
| Gate 4 fechado, `CONTAI-064` entregue, 2026-09-26 | `docs/backlog/79-2026-09-26-contai-064-entregue-e-d80-mascara-favorecido.md` — 11/11 critérios PASS, incluindo o critério 9 (`corrigir/emitente/page.tsx` ganha `?voltar=compra-cartao`, achado do `designer` confirmado no escopo pelo `cto-obra` no Gate 2). `FavorecidoHerdado`/`LigadoANota`/`sugerirValorDaNota` extraídos para `app/_components/nota-de-origem.tsx`, importados por `pagamento/page.tsx` e `compra-cartao/page.tsx` sem duplicação. Zero migration, como a Viabilidade previa. `npm run quality` verde: 1121 Vitest / 338 Playwright. **D80** nova (favorecido com CNPJ mascarado gravado por `compra-cartao` antes do ticket — query de diagnóstico ainda não rodada no banco remoto). Paga **parcialmente** a D79 (a captura herda; a quitação ainda não propaga — falta o `CONTAI-065`) |
| Gate 4 fechado, `CONTAI-054` entregue, 2026-09-25 | `docs/tickets/CONTAI-054.md` — 6/6 critérios PASS. Gate 1 inicial usou fixtures reconstruídas; o coordenador rodou `unpdf` de verdade contra as duas notas reais do ticket e achou que rótulo e valor saem em linhas separadas adjacentes, não na mesma linha — a feature original nunca dispararia nas notas que a motivaram. Corrigido: `extrairLinhasRotuladas` cobre os dois padrões. Duas decisões novas aprovadas nos Gates 2 técnico e fiscal: filtro de vocabulário "total"/"líquido" removido (retenção real pode se chamar "Total das Retenções"); combinações com líquido ≤ 0 descartadas (evita ambiguidade com campos zerados da reforma tributária). Recomendação herdada pelo `CONTAI-055`: rótulo sugerido em destaque visual. 1069 unitários + 300 E2E verdes |
| Gate 4 fechado, `CONTAI-053` entregue, 2026-09-25 | `docs/tickets/CONTAI-053.md` — 9/9 critérios PASS. `FormularioDeLinha` extraído de `app/_components/retencao.tsx` passou a aparecer também em `/adicionar/documento` (≥880px) quando o gate vira "destacada", mesma validação/textos da gestão, gravando em `documento_retencao` só depois de `criarDocumento`. Gate 2 técnico (`cto-obra`) pediu REQUEST CHANGES real: quarentena + falha de gravação da retenção pulava a confirmação sem mostrar o card parcial — corrigido, com E2E provando as duas coisas juntas. Ajuste de texto pós-Gate-2 registrado com transparência (concordância verbal lia mal em `total=1`/`entraram=0`). 1080 unitários + 307 E2E verdes |
| Gate 4 fechado, `CONTAI-055` entregue, backlog 71 fechado, 2026-09-25 | `docs/tickets/CONTAI-055.md` — 5/5 critérios PASS, último ticket do backlog 71. Sugestão do `CONTAI-054` pré-preenche o primeiro `FormularioDeLinha` do repeater do `CONTAI-053` quando o padrão bate, rótulo em destaque visual, sempre editável. Gate 2 técnico (`cto-obra`) achou bug de borda real (duas condições divergentes para "campo vazio" entre texto exibido e valor em centavos, um texto parcial fazia o valor herdar a sugestão em silêncio) — corrigido com condição única, provado por E2E que atrasa a resposta da rota de propósito. Gate 2 fiscal aprovou sem pendência. 1085 unitários + 313 E2E verdes. **Fila de implementação volta a vazia** |
| Três tickets criados a partir do relato 71, 2026-09-25 | `docs/tickets/CONTAI-053.md`/`054.md`/`055.md` — `/tickets-req` completo (po→contador→cto-obra→designer) nas duas stories. **Achado do `cto-obra` que fatiou US-B em dois**: a extração determinística (sem Gemini/Groq — parser de texto sobre o `unpdf`) é isolável e sem UI própria (**`054`**, pronto para `/develop`, sem bloqueio); a UI que recebe a sugestão só existe depois do repeater da captura (**`055`**, bloqueado por `053` e `054`). **Achado que revisou US-A**: o `BlocoRetencao` inteiro não cabe na captura (exige `documento.id` já persistido) — `053` reusa só o `FormularioDeLinha`, gravando as linhas depois do documento criado, no mesmo padrão não-transacional dos vínculos; **bloqueado por Gate 0** (`/design` nível 2, spec ainda não escrito). D75/D76 nomeadas no `054` (parser calibrado com um único layout real; PDF reenviado sem cache). **Fila de implementação: `054` pronto, `053`/`055` bloqueados** |
| Gate 4 fechado, `CONTAI-058` entregue, 2026-09-26 | `docs/tickets/CONTAI-058.md` — 7/7 critérios PASS. `ProvedorDeGestao` (`app/_components/gestao.tsx`) passou a depender de `usePathname()`, revalidando a cada navegação dentro do grupo `(gestao)`, com stale-while-revalidate (dado anterior fica na tela até o novo chegar, nunca reseta pra loading numa navegação normal). `cto-obra` ampliou o escopo do relato original: não são as 6 subrotas de `documento/[id]/*`, são 10, e o mesmo padrão isolado se repete em qualquer rota do grupo (`compromisso/[id]/confirmar`, `pagamento/[id]/*`, etc.) — corrigido de forma estrutural, não por lembrança rota a rota. Números medidos de verdade (não estimados) para a dívida residual: 16 requisições em 4 ondas por navegação normal; ~29 esperadas em produção ao entrar em `documento/[id]` (duplicação existente do `carregarPainel`, StrictMode + busca própria da página) — dívida não resolvida aqui, ticket futuro de unificação. 1085 unitários + 317 E2E verdes |
| Achado em produção pós-`CONTAI-056`, duas dores, DOIS tickets, 2026-09-26 | `docs/backlog/72-2026-09-26-legibilidade-despesas-e-cache-documento.md` — Mateus testou o `CONTAI-056` em produção: (1) total da Home não bate com a soma visual da coluna "Valor" em Despesas — investigação confirma que a Home soma certo, o problema é a coluna de maior destaque mostrar só o pagamento, não pagamento+retenção (retenção fica em anotação secundária); (2) mudar config de imposto num documento atualiza a própria tela na hora mas exige F5 para Home/Despesas — confirmado sistêmico: `ProvedorDeGestao` nunca revalida após mutação em nenhuma das seis subrotas de `documento/[id]/*`, não só `quem_recolhe`. Consulta ao `contador` sobre a Dor 1: **não é regra fiscal** (IN 84/2001 regula a discriminação e o documento, não layout de tela de gestão), vira **US-A** P1 de legibilidade, com recomendação não vinculante de relabel/ênfase visual. Dor 2 vira **US-B** P1, arquitetural, decisão do `cto-obra` antes de virar ticket. **Decisão: DOIS tickets**, causas técnicas independentes (composição visual local vs. cache/revalidação genérica) — justificativa completa na entrada. 3 perguntas abertas, sem resposta ainda |
| Gate 4 fechado, `CONTAI-057` entregue, backlog 72 fechado, 2026-09-26 | `docs/tickets/CONTAI-057.md` — 9/9 critérios PASS, último ticket do backlog 72 (o `058` já tinha sido entregue no mesmo dia). Coluna própria "Custo confirmado" (mono, semibold, direita, não sortável) entre "Valor lançado" (ex-"Valor") e "Situação"; `custoComprovadoCentavos` é campo derivado em `lib/fiscal/despesas.ts` (soma de `comprovadoCentavos` + `comprovadoPorRetencaoCentavos`, só no módulo puro), identificável no DOM por `data-custo-comprovado`. Chip verde perdeu o valor inline, chip de retenção manteve o dele. Gate 2 técnico (`cto-obra`) aprovou direto, com 1 nota cosmética não bloqueante (rótulo desatualizado em `desktop-shell-v1.md`), corrigida pelo coordenador sem mudar produto. Sem Gate Fiscal. `lib/fiscal/vinculo.ts` intocado, nenhuma soma nova em tela. 1085 unitários + 317 E2E verdes. **Fila de implementação volta a vazia** |
| Correção de diagnóstico: Achado 2 NÃO era bug, verificado em produção, 2026-09-26 | O Mateus apontou o furo antes de eu confirmar: "todos os valores inputados até agora são de 2026" — isso invalidava a hipótese de escopo de ano como causa do que ele via (o `CONTAI-060` continua válido, só deixa de explicar o sintoma relatado). Conferi produção ao vivo (`https://contai-rosy.vercel.app`, obra Casa Tanheiros): Home mostra "Custo confirmado em 2026: R$ 55.655,22"; a soma manual da coluna "Custo confirmado" em `/despesas` (8 lançamentos, excluindo o "—" de um sem comprovante) dá **exatamente R$ 55.655,22** — bate centavo a centavo, sem bug nenhum. A divergência que o Mateus via era somar a coluna "Valor lançado" (R$ 63.104,98) contra o KPI "Custo confirmado" da Home — diferença de R$ 7.449,76, que é **exatamente** o card separado "Custo em risco no IR" (nota paga sem comprovante, corretamente fora do custo confirmado por desenho — meta 1 do projeto). **`CONTAI-060` rebaixado para P2** (continua válido para quando a obra cruzar para 2027, mas não é o que foi relatado); `docs/tickets/CONTAI-060.md` e o backlog 73 atualizados para não confundir sessão futura |
| Tickets `CONTAI-059`/`060` criados, três perguntas fechadas pelo coordenador + 4 ratificações do contador, 2026-09-26 | `docs/tickets/CONTAI-059.md`/`060.md` — as 3 perguntas abertas do relato 73 decididas pelo coordenador (acumulado vira opção dentro de Despesas, não card na Home; sincroniza só Home+Despesas+Pendências agora; mesmo cartão, só texto muda). Gate de viabilidade do `cto-obra` achou complexidade nova: card de pendência é por DOCUMENTO (pode ter linha em Estado A e C juntas), chip/título também ficam falsos no Estado C, cor vermelha não se justifica mais para C, e linha sem `dataPagamento` precisa de regra explícita no filtro de ano — as 4 questões voltaram ao `contador`, que ratificou: prioridade do card é sempre o pior caso (A vence C); chip/título ganham variante para C ("Guia de retenção pendente" / "Recolhedor confirmado — guia ainda não paga"); **Estado C muda de vermelho para âmbar** (parecer que a dívida D54 exigia); linha sem data nunca soma em total nenhum e nunca some da tela. `CONTAI-060` fecha de graça a dívida do seletor de ano do `CONTAI-040`/`48` (`/pendencias` incluída). Os dois bloqueados por Gate 0 |
| Achado em produção pós-CONTAI-056/057/058, duas dores, DOIS tickets, 2026-09-26 | `docs/backlog/73-2026-09-26-texto-pendencia-retencao-e-escopo-ano-despesas.md` — (1) banner de retenção mostra o mesmo texto genérico ("sem confirmação de quem recolhe") mesmo depois de o Mateus confirmar "Eu" — vira **ADENDO 4** do parecer `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (dois estados reais, A e C; texto novo `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA` para o estado C, pendência de fluxo de caixa, não de identificação) → **US-A** P1; (2) `/despesas` não tem filtro de ano nenhum, soma manual diverge do KPI anual da Home por desenho, não por bug — contador confirma que "delta do ano" e "acumulado até uma data" são as duas grandezas fiscalmente válidas, "tudo sem corte temporal" não é → **US-B** P1, materializa em `/despesas` a dívida do "seletor de ano" nomeada em `48-…-gate1-decisoes-contai-040.md`. 3 perguntas abertas, sem resposta ainda |
| **D56 materializada em produção — relato novo, 2026-09-26** | `docs/backlog/74-2026-09-26-anexo-tardio-comprovante-pagamento-d56.md` — o Mateus foi anexar o comprovante do pagamento a FRANCISCO ALMEIDA (o "Custo em risco no IR" de `73-…md`) e não conseguiu: `/pagamento/[id]` só exibe "sem comprovante", sem controle de upload, e não existe função de escrita para anexar depois (só no fluxo de criação) — lacuna de backend, não só de UI. Precedente já existe no código (`anexar_arquivo_documento`, migrations `0014`/`0017`, mesmo padrão "só grava se o campo é null"). Parecer do `contador` em `docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md`: anexo tardio não afeta validade documental nem prazo decadencial; precisa capturar a **data do anexo** como metadado próprio (rastro obrigatório, parecer 2026-08-18 §5); custo sempre conta no ano do **pagamento**, nunca no do anexo, reaproveitando o detector de "ano já declarado" (mesmo parecer, §6) quando a DAA já foi entregue. Caso concreto: pagamento é de 2026, DAA de 2026 ainda não entregue — sem urgência de retificadora hoje. **US-D56, classificada P1** (sem imposto/multa vencendo, mas bloqueia o próprio mecanismo que a meta 1 pressupõe existir). As 3 perguntas fechadas pelo coordenador (controle simples, não o fluxo pesado da captura; não implementar agora o proxy real de "DAA entregue"; mantido P1) → vira **`CONTAI-061`**, bloqueado por Gate 0 |
| Ticket ainda por criar | `15-…-adjudicacao-fiscal-contai-027.md` → *"Ticket novo a criar — correção de valor de desembolso do terreno"*; e **`CONTAI-022`** (D26, cartão de crédito, **P0 fiscal**) e **`CONTAI-031`** (E2E da condição 6, P1, que **bloqueia a fatia 5 do `CONTAI-028`**) e **`CONTAI-032`** (D44, default de `data` e `meio`, **P0**, dependente do `CONTAI-025`) — nenhum dos três existe como arquivo. ➕ **`CONTAI-033`** (D49/D52, *nota grava sem o arquivo*, **P0**, com as **três guardas** do parecer como critério). ➕ ticket pequeno (S, P1) do critério 8 do `29-…-reconciliacao-contai-009.md` — `/documento/[id]` lista os pagamentos vinculados, porta que falta para o pagamento CONCILIADO |
| Relato novo, ticket criado, 2026-09-26 | `docs/backlog/75-2026-09-26-gate-retencao-sugerido-na-extracao.md` — Mateus clicou em "extrair automaticamente" numa NF do padrão que ele mesmo deu de exemplo pro `CONTAI-054`, e a retenção não veio: `sugerirLinhaRetencao` só roda depois de o gate `retencaoNaNota` já estar marcado "destacada" à mão, e `extrairDaNota()` (Gemini) nunca toca esse gate. **ADENDO 5** do parecer `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (mesmo dia): `retencaoNaNota` é FATO legível (categoria de data/CNPJ), diferente de `quem_recolhe`/`composicao`/`natureza_da_retencao` (que seguem proibidos); parser pode sugerir "destacada" (nunca "não destacada" nem "não sei"), sempre junto com a linha, na mesma ação, com 4 salvaguardas. Vira **`CONTAI-062`** (P1), Gate 0 corre no mesmo `/tickets-req` |
| Ticket criado, `CONTAI-063`, 2026-09-26 | `docs/tickets/CONTAI-063.md` — a partir de `docs/backlog/76-2026-09-26-filtro-sem-pagamento-despesas.md` (Mateus filtrou `/despesas` por texto "casa" só para ver as 4 notas "Sem pagamento ligado"; dropdown de Situação não tem opção que isole esse estado neutro por desenho, `CHIP_SEM_PAGAMENTO`). `/tickets-req` completo: **P1**, sem Gate Fiscal (confirmado pelo `po`/`cto-obra`, `contador` não acionado — filtro de leitura, aditivo). `cto-obra` fechou viabilidade S, sem migration (`LinhaDeDespesa` ganha booleano dedicado `semPagamentoLigado`, não vasculhar `situacoes` por chip). `designer` fechou spec nível 2 em `design/mocks/CONTAI-063.md` (rótulo "Sem pagamento ligado", fim da lista, textos de contagem/vazio reaproveitados). **Bloqueado por `CONTAI-060`** (mesmo arquivo `lib/fiscal/despesas.ts`, em retrabalho de Gate 2) — Gate 1 só depois do `060` commitado em `main` |
| Relato + parecer fiscal + ticket novo, 2026-09-26 | `docs/backlog/80-2026-09-26-comprovante-fatura-e-agendamento-retroativo-cartao.md` — Mateus, registrando uma compra de cartão retroativa (`/adicionar/compra-cartao`): não acha onde anexar "o comprovante do pagamento específico do item", e acha estranho o botão dizer "Agendar — não entra no custo" com datas já passadas. Parecer novo do `contador` (`docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`): comprovante único por FATURA está certo e suficiente (o evento de caixa é a liquidação da fatura); não existe comprovante por item que a fatura não supra (o item já é sustentado por NF do favorecido + comprovante da fatura); registro tardio não muda regime de caixa. **Diagnóstico: confusão de navegação, não dívida fiscal nova** — nenhuma pergunta pendente ao Mateus. `cto-obra`: redirect para `/fatura/[id]/confirmar` (em vez de `/fatura/[id]`) quando `dataVencimento <= hoje`, PP sem migration; texto do botão pode ganhar contexto condicional mantendo o prefixo "Agendar" (trava de 4 seletores E2E); formulário fundido recusado (M + migration, esconde compras irmãs). **D81** nova (desembolso duplicado quando compra atrasada entra em fatura que já tem desembolso) — fora deste ticket por disciplina de escopo. Vira **`CONTAI-066`** (P1, PP, sem migration) |
| Gate 4 fechado, `CONTAI-065` entregue, 2026-09-26 | `docs/backlog/81-2026-09-26-contai-065-entregue-e-d82-d83.md` — 8/8 critérios PASS. Migration `0020` (`propagar_vinculo_de_origem`) faz `fatura_desembolso_gravar`/`fatura_alocar` (cartão) e `quitarCompromisso` (PIX/boleto) propagarem `compromisso.documento_origem_id` para `pagamento_documento` na quitação, fechando a **D79** por completo (o `CONTAI-064` já pagava a metade, herança na captura). `npm run quality` verde: 1125 Vitest / 350 Playwright, incluindo 11 casos novos em `e2e/vinculo-de-origem.spec.ts`. **D82** nova (pagamento único quitando N compromissos com origens distintas propaga só a do primeiro processado) e **D83** nova (`pagamento.status` não acompanha o vínculo propagado — confirmado sem impacto fiscal) |
| ADENDO fiscal + ticket novo + correção de citação, 2026-09-26 | `docs/backlog/82-2026-09-26-contai-067-extrato-da-fatura-e-correcao-contai-066.md` — pergunta do Mateus depois de ler o parecer do `CONTAI-066` ("o que comprova que aquele pagamento foi pago em tal fatura?") vira **ADENDO** ao parecer `docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`: falta o **extrato da fatura** (PDF da administradora, terceiro, um por fatura) para amarrar compra↔fatura — hoje isso é só autodeclaração do Mateus, e é o que decide o ano-calendário do custo. Classificado gate fiscal novo. `/tickets-req` completo: `cto-obra` decide coluna `fatura.extrato_path` (nunca em `fatura_desembolso`), grant **de coluna** (nunca de tabela), RPC `anexar_extrato_fatura` (canônica em `/fatura/[id]`, nunca em `/parcial`), recomenda fila unificada de pendências no mesmo ticket (D47). Consulta pontual fecha cor **vermelha** (ADENDO 2 do mesmo parecer, régua do A.4) — veto só da discriminação Bens e Direitos, não da aferição INSS nem Pagamentos Efetuados. **D84/D85/D86** nomeadas. Vira **`CONTAI-067`** (P0, L). Gate 0 fechado no mesmo dia (`design/mocks/CONTAI-067.md`) — dois `CampoArquivo` em `/confirmar`, bloco de anexo tardio em `/fatura/[id]` com parágrafo explícito de NÃO-veto (Pagamentos Efetuados/aferição INSS intocados), card espelhando `documentos_sem_arquivo` na fila unificada; achado do Gate 0 vira critério 20 (`PapelDeAnexo` ganha `"extrato"`). **Pronto para `/develop`.** `CONTAI-066` recebe correção de citação: exclusão de "comprovante por item" continua válida, Gate Fiscal dele agora cita o ADENDO e não bloqueia por causa do requisito novo |
| Gate 4 fechado, `CONTAI-066` entregue, 2026-09-26 | `docs/backlog/83-2026-09-26-contai-066-entregue.md` — 8/8 critérios PASS. Sem migration. Na tela "Agendado", quando `dataVencimento <= hoje`, o rodapé passa a levar direto a `/fatura/{id}/confirmar` ("Confirmar o pagamento"), em vez de "Ver a fatura"; o mesmo Card ganha uma segunda `<Dica>` de wayfinding e o banner âmbar do formulário ganha a mesma frase assim que o Mateus digita o vencimento. Rótulo "Agendar — não entra no custo" continua literal (4 seletores E2E intactos); mecanismo de gravação intocado (`criarCompraCartao`, nunca `decidirRegistro`). `npm run typecheck`/`lint` limpos, `e2e/cartao.spec.ts` (16/16, 2 casos novos com datas relativas) e `e2e/compromisso.spec.ts` (12/12, o 4º seletor) verdes — `npm run quality` completo não rodado nesta rodada (fica registrado como pendência de confirmação antes do próximo `git push`). `067` fica sozinho na fila |
| Bug achado (PDF real), ticket criado, `CONTAI-068`, 2026-09-26 | `docs/backlog/84-2026-09-26-contai-068-retencao-duplicada-mesmo-valor.md` — `sugerirLinhaRetencao` (`CONTAI-054`/`062`) devolve `null` para a NFS-e de Palhoça/SC (o próprio exemplo original do `054`) porque a nota imprime o mesmo valor de retenção duas vezes sob rótulos diferentes ("Valor ISS"/"ISSRF"), e o `Map` de sugestões trata isso como ambiguidade. **ADENDO 6** do mesmo dia em `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`: valor idêntico sob rótulos diferentes é repetição, não ambiguidade; valores diferentes continuam `null`; `contador` veta desempate por vocabulário de emissor. `cto-obra` escolhe ordem de aparição no texto como critério de desempate (chave do `Map` passa a ser só o valor). Achado do Passo 1/3: o teste já existente "dois rótulos diferentes... ambiguidade genuína" (`ISSRF`/`Desconto Condicional`, ambos R$500) cai na mesma categoria e muda de `null` para sugestão — vira critério nomeado do ticket, não efeito colateral silencioso. P1, complexidade S, sem UI, sem migration. **Pronto para `/develop`, sem Gate 0**. ⚠️ **Correção, mesmo dia**: o critério 5 original generalizava demais — o `contador` nomeou **ADENDO 7** do mesmo parecer revertendo-o: colapso só quando AMBOS os rótulos empatados já são, isoladamente, terminologia de retenção (caso Palhoça); o teste `ISSRF`/`Desconto Condicional` permanece `null` ("Desconto Condicional" nunca é retenção — risco já nomeado pelo ADENDO 5 §2). Ticket ganhou critério 6 (triagem de vocabulário não-tributário: desconto/frete/parcela/acréscimo). Pergunta aberta anterior, fechada |
| ⚠️ Decisão do Mateus SOBREPÕE recomendação do `contador`, 2026-09-27 | `docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md` — dois pedidos do mesmo instinto pós-`CONTAI-062`: (1) sugerir `tributo` a partir do rótulo lido — **reprovado pelo `contador`, sem exceção** (critério 14 do `CONTAI-038`, pre-mortem 2 já previa o caso), **Mateus concordou**, não vira ticket de auto-preenchimento; alternativa aprovada (mostrar o rótulo bruto como texto de apoio) vira ticket menor. (2) marcar `cnoNaNota = "desta_obra"` automaticamente sob igualdade EXATA de dígitos — `contador` reprovou **duas vezes** (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, resposta original + ADENDO de reexame após o Mateus contestar com o precedente `garantirFavorecido`): a leitura é fato tão legível quanto a da retenção, mas `desta_obra` é o único dos três valores do gate em que o `CONTAI-007` já trata a direção "incluir" como erro sem conserto (bloqueia `outra_obra`), e automatizar essa direção troca "decidir" por "confirmar", vigilância degradada, sem rede de segurança (soma limpo em `baseCentavos`, proxy da aferição já conhecidamente superestimado, D57). **O Mateus, depois de ouvir a resposta refinada, discordou e pediu implementação mesmo assim** — decisão de apetite de risco do dono do produto, registrada com os dois pareceres completos. Vira ticket (`cto-obra`/`designer`), mesma linguagem visual do `CONTAI-062` (pílula âmbar + selo "Sugerida"). Achado à margem do ADENDO (sem análise de risco escrita para falso-positivo do `garantirFavorecido`) vira item de backlog separado, não entra neste ticket. **ADENDO mesmo dia**: o Mateus estendeu a mesma sobreposição ao `tributo` — *"aplique a mesma abordagem ao tributo"* — obsoletando a alternativa de "dica de texto" que o `contador` tinha aprovado; sugestão automática de `tributo` só quando o rótulo casar de forma inequívoca e exclusiva com 1 categoria (ambíguo, como "Total das Retenções (ISSQN/Federais)" do próprio ADENDO 6/7, vira silêncio) — salvaguarda que o `cto-obra` especifica com a lista de palavras-chave por categoria |
| Gate 4 fechado, `CONTAI-069` entregue, 2026-09-27 | `docs/backlog/86-2026-09-27-contai-069-entregue.md` — 18/18 critérios PASS, sem migration. Sugestão automática do gate `cnoNaNota` a partir do CNO impresso no PDF, implementada por decisão do Mateus que **sobrepõe** a reprovação (2×) do `contador` — registro completo em `85-2026-09-27-cno-automatico-contraria-contador.md` e `docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`. `compararCandidatosCno`/`sugerirCnoNaNota` (novo, `lib/fiscal/obra.ts`) exigem igualdade EXATA de 12 dígitos dos dois lados para sugerir `"desta_obra"`; cadastro fora de formato ou dígitos diferentes vira `"diverge"` (banner com os dois números, nunca silêncio — critério 5 corrigido no Gate 2 para bater com esse comportamento, e o estado `formato_invalido` separado que o `contador` sugeriu como melhoria futura vira **D87**, sem ticket). Extrator próprio `lib/extracao/cno-texto.ts` (rótulo âncora, nunca dígito solto). Rota `/api/sugerir-retencao` devolve candidatos crus, comparação sempre no cliente contra a obra corrente. `outra_obra`/`nao_traz` continuam 100% manuais por construção de tipo. Nenhum arquivo mudou depois do APPROVE final do `cto-obra`. **1169 Vitest / 369 Playwright** (362 pré-existentes + 7 novos em `e2e/captura-cno.spec.ts`), typecheck/lint limpos. `070` (sugestão automática de `tributo`) fica sozinho na fila |
| Gate 4 fechado, `CONTAI-070` entregue, 2026-09-27 | `docs/backlog/87-2026-09-27-contai-070-entregue.md` — 12/12 critérios PASS, sem migration. Sugestão automática de `composicao`+`tributo` a partir do(s) rótulo(s) lidos na linha de retenção, segunda metade da mesma decisão do Mateus que **sobrepõe** a reprovação do `contador` (mesmos pareceres do `CONTAI-069`). `sugerirTributoDoRotulo` (novo, `lib/extracao/tributo-rotulo.ts`) exige match único e exclusivo entre TODOS os rótulos empatados (`rotulosEmpatados`, campo novo de `SugestaoLinhaRetencao`); marcador de combinação ("Retenções", "Federais", "CSRF", `+`, `/`) veta antes de contar categoria. Contraexemplo real do parecer ("Total das Retenções (ISSQN / Federais)") produz `null`, testado. Rota devolve `tributoSugerido` como campo IRMÃO de `sugestao` (nunca dentro dela) — divergência do mock original julgada **melhoria legítima no Gate 2**. `linhaSugerida` ganha 2º parâmetro para o par; `FormularioDeLinha` usa UM estado de origem para os dois campos, estruturalmente impedindo um sugerido e o outro manual. Troca de anexo mata só a parte sugerida. `eDescontoEfetivo`/`quemRecolhe` seguem 100% manuais. Nenhum arquivo mudou depois do APPROVE do `cto-obra`. **1185 Vitest / 373 Playwright**, typecheck/lint limpos. **D88** nova (achado do Gate 2: `/\bIR(RF|PJ)?\b/i` casaria "ir" comum por ser case-insensitive nessa sigla de 2 letras; risco baixo, precisa de olhar do `contador`). Fila fica vazia — nenhum ticket com Gate 0 fechado pendente de `/develop` |
| Bug relatado + reproduzido + ticket criado, `CONTAI-071`, 2026-09-27 | `docs/backlog/88-2026-09-27-contai-071-registrar-outra-compra-nao-reseta.md` — Mateus reportou "cliquei em registrar outra compra e nada aconteceu" (screenshot da tela "Agendado" persistindo). Causa: `<BotaoLink href="/adicionar/compra-cartao">` na tela "Agendado" aponta para a MESMA URL onde o usuário já está — Next não navega, estado não reseta (`app/(captura)/adicionar/compra-cartao/page.tsx:393-395`). `cto-obra` confirmou a causa em código-fonte do Next (`createRouterCacheKey` ignora query string, `layout-router.js:549`) e **discordou do reset manual campo a campo** sugerido no relato: recomendou remount por `key` em `Pagina` (zera todo o estado, inclusive o que tickets futuros venham a adicionar) + `router.replace` para limpar a URL — cobre as DUAS portas de vazamento da herança de nota do `CONTAI-064` (sessão corrente e F5 subsequente), não só uma. Bug isolado (confirmado por `grep`; `/adicionar/documento` e `/adicionar/pagamento` não têm o padrão; `/fatura/[id]` tem o mesmo rótulo mas rota/URL diferentes, sem bug). `/tickets-req` só Passo 1+3 (sem Gate Fiscal, sem UI nova). Vira **`CONTAI-071`** (P1, S, sem migration). **Pronto para `/develop`, sem Gate 0** |
| Achado de produção + ticket criado, `CONTAI-072`, 2026-09-27 | `docs/backlog/89-2026-09-27-contai-072-nota-com-compromisso-aberto.md` — Mateus achou, por consulta direta ao banco (read-only), 3 notas que aparecem ao mesmo tempo no card "Notas hábeis sem pagamento vinculado" (CTA "Ligar a um pagamento", como órfãs) e em "Agenda — próximos compromissos" (já com compra de cartão agendada, mesmo favorecido/valor) — causa raiz em `documentosHabeisSemPagamento` (`lib/fiscal/vinculo.ts:981-987`), que nunca olha `compromisso` nenhum, e alimenta Home e `/despesas` pela mesma fonte. `contador` confirma que o parecer `2026-08-18-compromisso-versus-pagamento.md` já fecha o caso sem parecer novo: a nota **nunca sai** da lista/soma (compromisso não é pagamento, pode ser cancelado), só **texto/CTA** muda, em DOIS sub-estados — achado extra dele: o ADENDO §A do mesmo parecer já trata compromisso **vencido sem resposta** como bloqueio de relatório anual, então o texto do vencido precisa escalar urgência, não só "já agendado". `cto-obra`: zero migration; compromisso não pode entrar em `vinculo.ts`/`resumo.ts` (barreira de tipo já existente) — função pura nova `agendamentosPorDocumento` em `lib/fiscal/compromisso.ts`, cruzamento no consumidor da Home e importação direta em `despesas.ts` (sem a mesma barreira); complexidade S/M. `designer`: nível 3 (tabela antes/depois, sem mock separado), reaproveita 100% de texto já existente (`chipDoAgendado`, `resumoDoAgendamento`, `VENCIDO_SEM_RESPOSTA`) e confirma que nenhum dos dois sub-estados usa vermelho (escala por peso visual, não por matiz, porque nenhum dinheiro saiu da conta). **Pronto para `/develop`, sem pergunta pendente do Mateus.** |
| Bug relatado + ticket criado, `CONTAI-073`, 2026-09-28 | `docs/backlog/90-2026-09-28-contai-073-corrigir-valor-compromisso.md` — não existe NENHUMA forma de corrigir `compromisso.valor_previsto` (`grep` em `lib/data.ts`: só há correção de DATA e correção de valor da NOTA, entidade diferente). Relato: Mateus digitou o valor errado numa parcela de compra no cartão. `contador` fecha Gate Fiscal sem impacto (previsão pura, zero para custo/aferição — `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §1/§3, inclusive em quitação parcial). `cto-obra` acha invariante que faltava: valor novo ≤ soma já paga zeraria o saldo em silêncio — vira guarda dura na RPC nova `corrigir_valor_compromisso`. Tabela nova `compromisso_valor_historico` (não reaproveita `compromisso_data_historico`, por causa do contador de "adiamentos"), motivo em `text` livre. Rota nova `/compromisso/[id]/valor`, não unificada com `/data`. `designer`: nível 2, `design/mocks/CONTAI-073.md`. Cenário gestão, complexidade M. **Pronto para `/develop`.** |
| Relato + ticket criado, `CONTAI-074`, 2026-09-28 | `docs/backlog/91-2026-09-28-contai-074-pagamento-em-duas-notas.md` — Mateus, registrando um fornecedor de concreto usinado com 3 notas pagas por 7 parcelas (PIX + 2 cartões em 3x) sem correspondência 1-para-1, tentou ligar uma parcela já ligada à Nota A também à Nota B; `pagamentosCandidatos`/`documentosCandidatos` (`lib/fiscal/vinculo.ts`) escondiam qualquer candidato já 100% absorvido, embora o teto `min(Σ pagamentos, Σ documentos hábeis)` por componente conexo já torne a segunda ligação matematicamente segura. `contador` aprova sem restrição de valor (ADENDO novo em `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`) e corrige, no fechamento, a cláusula final do aviso espelhado para `/pagamento/[id]/ligar` (a garantia lá é "a mesma nota não duplica no custo", não "o mesmo pagamento" — dois pagamentos reais provam a mesma nota, direção diferente do original). `cto-obra` discorda do enquadramento inicial (o aviso vale para todo candidato com vínculo prévio, não só os ocultos) e redesenha `Candidato<T, Outro>` com `jaLigadoA`/`cobertoPorInteiro` como flags, sem migration (`pagamento_documento` já N:M). `designer`: nível 2, `design/mocks/CONTAI-074.md` (bloco colapsado revelável, `Chip` âmbar sempre visível, aviso inline por item, frase de custo zero explicada). Terceira tela consumidora (`adicionar/documento`, captura) fica fora de escopo, comportamento preservado. Dívida nomeada para a futura ficha Pagamentos Efetuados (somar por `pagamento.id`, nunca por linha de `pagamento_documento`). Cenário gestão, complexidade M. **Pronto para `/develop`.** |
| Relato processado, ticket criado, `CONTAI-075`, 2026-09-28 | `docs/backlog/92-2026-09-28-destaque-progressivo-agendamento-hoje-amanha.md` — Mateus perguntou se o app notifica/destaca compromissos perto do vencimento; achado de código: `chipDoAgendado`/`porPrioridadeDoAgendamento` (`lib/fiscal/compromisso.ts`) só reagiam **depois** do vencimento, sem notificação ativa nenhuma (push/e-mail/Google Calendar — zero integração real, apesar de constar na stack). Mateus escolheu destaque progressivo dentro do próprio app (opção b) e autorizou o time a decidir sozinho, sem esperar aprovação dele — as 3 perguntas do relato foram resolvidas na própria rodada do `/tickets-req`: 2 graus fixos (hoje/amanhã), aplicado a toda tela que já exibe o chip (Home/`/compromisso`/`/despesas`), 1 peso visual intermediário só (texto é o canal primário de diferenciação, não dois pesos próximos e indistinguíveis). `contador`: sem impacto fiscal, condição de hierarquia (peso sempre estritamente menor que o vencido, sem prometer bloqueio). `cto-obra`: `forte: boolean`/`vazado: boolean` somem, viram união `UrgenciaDoAgendamento` de 4 valores + `Record` exaustivo (trava de compilação contra consumidor esquecido); zero migration. `designer`: nível 2, `design/mocks/CONTAI-075.md`. Cenário gestão, complexidade S. **Pronto para `/develop`.** Detalhe: `docs/tickets/CONTAI-075.md` |
| Ticket criado, `CONTAI-076`, 2026-09-28 | `docs/backlog/93-2026-09-28-menu-lateral-agenda-e-faturas.md` — Mateus pediu Agenda/Compromissos e Faturas no menu lateral. Investigação achou discrepância: `/compromisso` é tela completa hoje só alcançável via link na Home, mas **não existe tela de lista de Faturas** (só `/fatura/[id]` com id obrigatório). Apresentadas 3 opções ao Mateus; **escolheu só Agenda agora** — Faturas fica de fora, registrada para retomada futura. `/tickets-req` completo: sem Gate Fiscal (navegação pura). `cto-obra` achou e resolveu um conflito real — `/compromisso` estava mapeado para acender "Visão geral" (`VIEW_DA_ROTA_DE_DETALHE`), então o item novo nunca acenderia sem remover esse mapeamento e o `daRaiz` do breadcrumb. Rótulo "Agenda", 4ª posição (antes de Obras). `designer`: nível 3, `design/mocks/CONTAI-076.md`. P2, complexidade S, sem migration. **Pronto para `/develop`.** Detalhe: `docs/tickets/CONTAI-076.md` |
| Dois tickets criados, `CONTAI-077`/`CONTAI-078`, 2026-09-28 | `docs/backlog/94-2026-09-28-scroll-e-busca-nas-telas-de-ligar.md` — Mateus, tentando ligar uma 2ª parcela de cartão à nota real "Ilhamix Concreto Ltda" (NF 1543), relatou três sintomas: "agendamento não aparece" (esclarecido, não é bug — regime de caixa), "scroll quebrado" e falta de busca (os dois confirmados ao vivo). A "solução" que ele propôs já existe (`/pagamento/[id]/ligar`, `CONTAI-074`) — ele não sabia. `/tickets-req` completo: `cto-obra` discordou do diagnóstico inicial (não é falta de `padding-bottom` — `RodapeDeAcao` é `sticky` DENTRO da área que rola, sobrepõe por definição) e da junção num ticket só (zero arquivo em comum) — virou **`CONTAI-077`** (scroll: `RodapeDeAcao` passa a renderizar por portal FORA da área rolável, mesmo princípio da casca de 430px; afeta as 22 telas que usam o padrão) e **`CONTAI-078`** (busca: favorecido+valor, substring client-side, só acima de 5 candidatos, com estado de vazio-por-filtro novo — o vazio de hoje afirma consequência fiscal que mentiria se fosse por causa do filtro). Sem Gate Fiscal nos dois. **CONTAI-077 pronto para `/develop`** (sem designer — correção puramente técnica). **CONTAI-078 aguardando mock do designer.** Detalhe: `docs/tickets/CONTAI-077.md`, `docs/tickets/CONTAI-078.md` |
| Ticket criado, `CONTAI-079`, 2026-09-28 | `docs/backlog/95-2026-09-28-contai-077-topo-ainda-sobrepoe.md` — Mateus testou o `CONTAI-077` em produção: rodapé resolvido, mas *"tem o mesmo problema na parte de cima"* — o card `sticky top-0` ("Falta ligar desta nota") continua sobrepondo linhas da lista, dívida que o `CONTAI-077` já tinha nomeado e deixado de fora. "Agendamentos não aparecem" **reconfirmado** (2ª vez) como comportamento correto de regime de caixa já explicado em `94-…` — não virou ticket. `/tickets-req` completo: sem Gate Fiscal. `cto-obra` decidiu por `slotDoTopo`, espelho exato do `slotDoRodape` do `077` (plumbing já existe) — descartou alternativas locais (tirar o sticky perde o número que atualiza; `scroll-padding-top` só resolve foco). Sem extrair o conteúdo do card num componente compartilhado (só 2 usos, texto diferente). Complexidade S, sem migration, sem designer. **Pronto para `/develop`.** Detalhe: `docs/tickets/CONTAI-079.md` |
| Ticket criado, `CONTAI-080` (+ `CONTAI-081` reservado), 2026-09-28 | `docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md` — Mateus, mesmo fornecedor de concreto do `CONTAI-074` (3 notas, 7 parcelas sem correspondência 1-para-1), quer pré-vincular uma parcela ainda não paga a uma ou mais notas antes do pagamento. `contador` fechou Gate Fiscal em 3 rodadas no parecer `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`: **ADENDO 6** (natureza do pré-vínculo, nunca custo, chip neutro), **ADENDO 7** (o Mateus contestou "sempre clique explícito" citando que `documento_origem_id`/CONTAI-065 já converte sozinho pra 1 nota — contador concordou e reescreveu: **N=1 automático, N≥2 exige confirmação**, contado sobre a união pré-vínculo+origem, achado do `cto-obra`), **ADENDO 8** (corrigiu um texto que ficara falso pra N=1 depois do ADENDO 7). `cto-obra` também separou o fluxo de cartão pro **CONTAI-081** (arquitetura de RPC diferente do PIX/boleto), confirmado pelo Mateus. `designer`: nível 1 (tela nova `/compromisso/[id]/pre-vincular`) + nível 2 (4 telas existentes), `design/mocks/CONTAI-080.md`. Migration nova (tabela `compromisso_documento_previsto`), complexidade L. **Pronto para `/develop`.** 🔓 **Pergunta em aberto aberta no Gate 2 (`po`/`designer`)**: a sugestão de quitação rápida (`quitacao.tsx`) com N≥2 quita e **não converte nada** — a união fica pré-marcada em `/pagamento/[id]/ligar`, porque aquele card não tem onde fazer a pergunta do §J.3. Aprovado como correto pelo Gate 2 e travado por E2E; falta decidir se ela merece o bloco de revalidação próprio. Detalhe: `docs/tickets/CONTAI-080.md` (bloco "Comportamento nomeado") e `docs/backlog/96-…md` |

✅ **7ª revisão aplicada em 2026-08-23**, direto em `docs/tickets/README.md`. O
**porquê** — movimentos, cortes, a dívida da premissa paga e a **D44** — está em
`docs/backlog/21-2026-08-23-setima-revisao-da-fila.md`, que **não repete a
ordem**.

✅ **Adendo do mesmo dia aplicado (23/08)**, também direto em
`docs/tickets/README.md`: o parecer
`docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md`
destravou o `008` no fiscal, criou o **`CONTAI-032`** e trouxe o **`CONTAI-025`**
para dentro da fila como **pré-requisito** dele. O porquê está em
`docs/backlog/22-2026-08-23-adendo-a-setima-revisao.md`. **Não é 8ª revisão** — é
a aplicação de um fato aos itens que ele toca.

⚠️ **As 6 "Fila revista" do diário são REGISTRO HISTÓRICO, não a ordem de hoje.**
Desde 2026-08-23 a ordem vive em `docs/tickets/README.md`, e só lá. As filas do
diário ficam como o raciocínio datado de cada reordenação — 1ª e 2ª em
`05-…-relato-003.md`, 3ª e 4ª em `06-…-gate2-contai-003.md`, 5ª em
`07-…-gate4-contai-002.md`, 6ª em `08-…-incidente-producao-e-fila-vigente.md`.

**Citar qualquer uma delas como ordem vigente é erro**, inclusive a 6ª: ela é de
18/08 e seus dois primeiros itens já estão em produção. Foi essa divergência que
motivou a mudança.

**Fila do diário não se edita** — ela é registro datado. Fila nova é entrada
nova, e este ponteiro passa a apontar para ela.

⚠️ **Status de entrega NÃO mora aqui.** Quem sabe o que foi entregue, com hash de gate por ticket, é
`docs/tickets/README.md` — ele é o mapa. Este índice aponta para **decisões e dores**; duplicar status
nos dois faria os dois divergirem, e ninguém saberia qual mente.

## Fato da obra — consulte aqui ANTES de perguntar ao Mateus

Regra do `CLAUDE.md`: fato da obra se consulta, não se pergunta. As respostas
que já existem estão em:

| Entrada | Seção |
|---|---|
| `02-2026-08-07-relato-001.md` | Perguntas respondidas (2026-08-07) |
| `03-2026-08-07-relato-002.md` | Perguntas fechadas pelo contador (2026-08-08) |
| `05-2026-08-09-relato-003.md` | Perguntas Q11–Q13 — respondidas pelo Mateus em 2026-08-09 |
| `14-2026-08-21-relato-004.md` | Fato da obra registrado (para não ser reperguntado) |
| `24-2026-08-23-relato-005.md` | **Respondidas em 23/08**: comunhão **universal** · matrícula com **os dois nomes** · **cada um declara sua parcela** no IR · rateio **pelo percentual do financiamento** · existe uma **2ª obra, com o sogro, para venda** |
| `24-2026-08-23-relato-005.md` | Fato da obra registrado — **de que conta saiu o dinheiro do terreno** |

Perguntas **ainda abertas**: `03-…-relato-002.md` → *"Perguntas abertas"*;
`05-…-relato-003.md` → *"Perguntas e riscos que o 2º parecer abriu"*; e a Q14
no bloco de decisões pendentes acima.

## Dívidas nomeadas — onde cada uma foi registrada

| Dívida | Entrada |
|---|---|
| D28, D29, D30, D32 | `10-2026-08-18-dividas-gate2-contai-019.md` |
| D31 | `09-2026-08-18-d31-regime-de-caixa.md` |
| D19 (reaberta) | `12-2026-08-19-gate1-contai-021.md` |
| R1–R5 do CONTAI-021 | `13-2026-08-21-gates2-4-contai-021.md` |
| D35 | `14-2026-08-21-relato-004.md` |
| D39 | `15-2026-08-21-adjudicacao-fiscal-contai-027.md` |
| D41 — 4 textos desatualizados em mocks aprovados (login, defaults, carimbo) | `17-2026-08-22-o-que-a-extracao-dos-specs-achou.md` |
| **D42 — condição fiscal 6 sem rede NENHUMA** (nem unit, nem E2E): correção de classificação pode inventar retificadora | `19-2026-08-23-duas-condicoes-fiscais-sem-rede.md` → **`CONTAI-031` (E2E), P1**, decidido em `20-2026-08-23-gate4-contai-029.md`. **Bloqueia a fatia 5 do `CONTAI-028`** |
| D43 — formato do rastro (`p_depois`) é expressão anônima dentro da RPC, com **uma única** asserção E2E a protegê-lo | `19-…-duas-condicoes-fiscais-sem-rede.md`; **dividida em duas no Gate 4** (`20-…-gate4-contai-029.md`): o comentário-guarda em `e2e/correcao.spec.ts:96` vai no **`CONTAI-031`** (custo zero, hoje); a extração de `textoDoRastro` fica na **fatia 5 do `CONTAI-028`** |
| **D44 — RESPONDIDA em 23/08** (`docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md` §1): default de `data` E `meio` em produção (`app/adicionar/pagamento/page.tsx:163`, `:169`). A data afirma **dois** fatos — `decidirRegistro` escolhe a ENTIDADE por ela — e o `meio` pré-selecionado torna a recusa do cartão **inalcançável pela inação** | → **`CONTAI-032`**, que **depende do `CONTAI-025`**: tirar o default sem o terceiro estado troca data errada em silêncio por **data inventada pelo dedo**, que é pior |
| **D45 — o bloqueio de mover NF de serviço está errado no saldo** (`docs/pareceres/2026-08-23-default-em-campo-fiscal-e-cno-na-correcao-de-obra.md` §2): protege uma aferição que o app **nem calcula**, ao preço de travar o custo de aquisição no imóvel errado — o único dos dois que já produz passivo, em **duas** vendas futuras. A restrição nunca teve carimbo de parecer | → `CONTAI-008` **destravado** (independente da Q14); a trava migra para a apuração, no `CONTAI-004` |
| **D46 — condição fiscal em ticket sem parecer que a carimbe** (classe, não incidente — a **D32** já nomeara a mesma forma): o critério 13 do `CONTAI-003` levava *"**Restrição fiscal**"* em negrito citando **um ticket**, nenhum parecer; o código a endureceu de *revalidar* para **recusar** e ela travou um **P0** por 13 dias | `22-2026-08-23-adendo-a-setima-revisao.md` → *"O achado de processo"*. **Remédio redigido** (três inserções no `/tickets-req`); **instalar em `.claude/commands/tickets-req.md` é do Mateus**. Varredura retroativa: **uma** linha ofensora hoje, já revogada |
| **D47 — a pergunta que o app sabe que deve fazer, e não faz em superfície nenhuma**: `perguntaPendente`/`perguntaRepresada` só são lidas pelo formulário de anexar — um "sim" superado **não acende em card nem na home**. Agravante: `completarDesembolsoTerreno` faz **duas escritas sem transação**, e a justificativa escrita para isso invoca uma superfície que não existe | `23-2026-08-23-gate4-contai-027.md`. → **ticket novo**, que ⛔ **nasce com parecer do `contador` para o texto do chip ANTES do mock** |
| **D48 — o critério 12b do `CONTAI-027` carrega frase que nenhum parecer carimbou** (*"a resposta nova é gravada sem apagar a anterior"*, atribuída ao §4d **sem estar lá**). É a **D46 na forma inversa** — e **muda a contagem da varredura retroativa da D46: são duas linhas ofensoras, não uma, e a segunda está viva** | `23-2026-08-23-gate4-contai-027.md`. → **pergunta aberta nº 3 ao `contador`**, no corpo do `CONTAI-027` |
| **D49 — travas de anexo-PROVA recusando fato consumado, sem parecer que as carimbe** (superfícies 3 e 4). **Terceira ofensora da classe D46/D48**, e a de espécie diferente: as outras produziram texto errado, esta **produziu abandono do produto** | `24-2026-08-23-relato-005.md`. Resolvida pelo parecer `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md` (**ADENDO 1 vence o corpo**) → **US-A** no `CONTAI-025`, **US-B** em ticket novo |
| **D50 — `lib/fiscal/terreno.ts` soma por `estado`+`data`, sem olhar anexo**: liberada a gravação, passa a somar custo não demonstrável **em silêncio**, na direção do **D34** | `24-…-relato-005.md` → **mesma entrega da D49**, não depois |
| **D54 — a régua de cor não tem gate**: a D39 manda toda pendência nova declarar a metade que a colore, e isso é **norma sem verificador** — a D44 outra vez | `25-2026-08-23-a-regua-de-cor-e-o-que-ela-escondia.md` → teste que trava a régua, no **`CONTAI-035`** |
| **D55 — `composicaoDaDiscriminacao` (tela do `CONTAI-021`, em produção) pondera documento individual por ordem de `id` "sem efeito fiscal nenhum"** | `27-2026-08-24-defeito-vivo-composicao-material-mao-de-obra.md` — decisão do `po`, muda número em tela já entregue |
| **D53 — quem pagou o quê: pessoas ligadas à obra, co-pagamento em percentual/valor/partes, e apuração POR NOME** | `24-2026-08-23-relato-005.md` — **ticket próprio, decisão do Mateus em 23/08**. ⚠️ **Não é a US-D** (aquilo era um campo): é **modelo de dados, RLS e as três saídas anuais** mudando de "por obra" para "por obra **E por pessoa**". A US-D é subconjunto e provavelmente deixa de existir sozinha. Carrega o alerta de **equiparação a PJ** (art. 166+ RIR/2018, `[Likely]`) |
| **D51 — não existe onde registrar de qual conta o dinheiro saiu** (parte dos desembolsos do terreno saiu da conta do cônjuge). Comprovante de terceiro *não se descarta e não se converte* | `24-…-relato-005.md` → **US-D**, ⛔ **bloqueada pelas 3 perguntas ao Mateus** |
| **D52 — a superfície 3 exige migration**: `documento.arquivo_path` é `not null` na `0001` e `status_documento` não tem valor para "registrado sem arquivo"; ⚠️ **`quarentena` não pode ser reaproveitada** | `24-…-relato-005.md` → dentro do ticket da **US-B**; a decisão de modelo é do `cto-obra`, não do `po` |
| D40 — `lib/data.ts` monolítico (2065 linhas, 44 importadores) | `16-2026-08-22-custo-de-contexto-do-pipeline.md` → **`CONTAI-028`**; status em `18-2026-08-23-gate4-contai-028-fatia1.md` (**parcialmente paga**: 2065 → 1803) |
| **D56 — comprovante que falta em registro antigo não tem caminho de correção pela interface**; achado em produção (26/09) confirma que é lacuna também de **backend** (não existe função de escrita para anexar comprovante a pagamento já existente, só no fluxo de criação) | `29-2026-08-24-reconciliacao-contai-009.md`. Checagem do `contador` **feita** em `docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md`: anexo tardio não afeta validade documental nem prazo decadencial; exige metadado novo (data do anexo, com rastro); custo conta sempre no ano do PAGAMENTO, reaproveitando o detector de "ano já declarado" do parecer de 2026-08-18. Falta mock (`designer`) e decisão de prioridade P0×P1 (`po`) |
| **D57 — falta o único campo que de fato abate a aferição do SERO** ("esta mão de obra foi declarada no CNO?", A.5/Pergunta 2 do parecer de 2026-08-18): não existe em schema, tela nem ticket, confirmado por busca em 2026-09-19 | `31-2026-09-19-sequenciamento-contai-035-038.md` → sem ticket ainda, fica para quando o Mateus priorizar |
| **D58 — `/adicionar/pagamento` também mostra "Arquivo guardado no acervo" ao salvar sem comprovante** (mesmo `Registrado`, mesmo texto fixo; bug anterior ao CONTAI-033) | `33-2026-09-20-tres-bugs-achados-no-teste-manual-do-contai-033.md` → prop `arquivoNoAcervo` já existe em `Registrado`, falta só a chamada em `/adicionar/pagamento` |
| **D59 — o banner "Nenhuma pendência" da home só olha `resumo.pendencias`, ignorando todo agregado "fora de pendencias"** (`terrenoPagoSemComprovante` e os outros cinco); corrigido só para `documentosSemArquivo` | `33-2026-09-20-tres-bugs-achados-no-teste-manual-do-contai-033.md` → auditoria dos outros cinco, decidir se vira um helper único |
| **D65 — RESPONDIDA no Gate 2 do `CONTAI-034` (21/09)**: `cValor` pré-preenchido com o saldo previsto em `/compromisso/[id]/confirmar`, mesma forma da D44; corrigida dentro do próprio ticket por decisão do `contador`, não em ticket separado | `40-2026-09-21-contai-034-entregue.md` — fechada, sem ticket futuro |
| **D66 — `unidades_autonomas` nasce `"1"` contra o `SEM DEFAULT` do `CONTAI-003`**, achada pelo mapa do `CONTAI-034` e não corrigida (doutrina "prova, não conserta" do próprio ticket); passo 4 do assistente de `/obras/nova`, fora da rota que a suíte visita | `40-2026-09-21-contai-034-entregue.md` → falta ticket de conserto |
| **D68 — "Passo 2 de 3" e "Passo 3 de 3" convivem na mesma página de `documento/page.tsx`** (o hub fixa "Passo 1 de 3", o rótulo interno muda duas vezes no scroll de uma única tela); pré-existente, achada ao fechar o Gate 0 do `CONTAI-047`, não introduzida por ele | `59-2026-09-22-decisao-po-mock-captura-desktop.md` → sem ticket, sem prioridade hoje |
| **D69 — validação em iPhone real (Safari) + macOS Safari do preview de PDF do `CONTAI-048` não foi feita**: nem CI (webkit do Playwright roda em Linux, sem viewer de PDF) nem o Gate 3/4 (Chrome desktop) provam o comportamento nativo do Safari iOS ao abrir um PDF em nova aba, nem o `<object>` em macOS Safari com um PDF real de ≥2 páginas — exatamente o risco que o critério 3 do ticket existe para corrigir | `65-2026-09-23-contai-048-entregue.md` → sem ticket, confirmação manual do Mateus pendente (não bloqueia o fechamento do `048`) |
| **D70 — RESOLVIDA no Gate 4 do `CONTAI-052` (25/09)**: `fetch()` da extração Gemini não tinha timeout explícito nem a rota declarava `maxDuration` | `69-2026-09-25-contai-052-entregue.md` → `AbortSignal.timeout()` por tentativa nos dois provedores (Groq 10s, Gemini 20s) + `maxDuration=60` na rota, confirmado no código |
| **D71 — RESOLVIDA em 25/09**: caminho Groq nunca tinha sido exercitado contra a API real, só mockado. Na primeira exercitação real em produção (chave configurada na Vercel), achou exatamente o que a dívida previa: `llama-3.3-70b-versatile` (default hardcoded) tinha sido descontinuado pela Groq, 404 em toda chamada | `70-2026-09-25-incidente-groq-modelo-descontinuado.md` → default trocado para `openai/gpt-oss-120b` + `reasoning_effort: "low"`, verificado por chamada real |
| **D72 — heurística de "texto suficiente" da extração (`lib/extracao/texto-pdf.ts`) calibrada só com fixtures sintéticas**, sem PDF de scan/foto real da obra para ajustar os thresholds (200 caracteres, 5% de lixo) | `69-2026-09-25-contai-052-entregue.md` → pre-mortem do `CONTAI-052` pedia esse teste; fica para quando aparecer um caso real de scan na captura do canteiro; risco mitigado (não eliminado) pela verificação campo-contra-fonte |
| **D73 — nome de modelo de provedor externo (Gemini/Groq) não tem verificação automática de que ainda existe** — segundo incidente da mesma classe (Gemini `thinkingLevel` por modelo; Groq `llama-3.3-70b-versatile` descontinuado) | `70-2026-09-25-incidente-groq-modelo-descontinuado.md` → exigiria segredo de produção no CI (proibido) ou alerta operacional; sem ticket, não bloqueante |
| **D75 — parser determinístico de retenção (`CONTAI-054`) validado só com dois exemplos reais de NFS-e, os dois de SC** (um layout municipal antigo, um no padrão nacional "DANFSe v2.0") — o segundo exemplo confirmou "total"/"líquido" como vocabulário comum entre os dois, mas também revelou que uma nota pode ter múltiplos rótulos batendo com cada palavra (campos de IBS/CBS da reforma tributária), resolvido por busca combinatória + aritmética, não "primeiro que achar" | `docs/tickets/CONTAI-054.md` → cada novo layout real (de outro estado/regime) vira caso de teste próprio, nunca regra genérica antecipada; não bloqueante |
| **D76 — rota `/api/sugerir-retencao` (`CONTAI-054`) reenvia o PDF inteiro sem cache de texto por hash** | `docs/tickets/CONTAI-054.md` → aceitável no volume da obra; cache fica para se virar incômodo de verdade |
| **D77 — retenção confirmada numa nota pode "cobrir" OUTRA nota do mesmo componente de vínculo** (`CONTAI-056`, Gate 2 do `cto-obra`, 2026-09-25): o `min(Σ pernas, Σ documentos hábeis)` de `alocarCusto` é calculado **por componente conexo**, e ali a perna de retenção é tratada como fungível entre as notas do grupo — o que ela **não é** (ela é quitação de UMA nota). Caso numérico achado pelo `cto-obra`: nota A de R$ 10.000 paga pelo **bruto** + retenção de R$ 500 confirmada, nota B de R$ 10.000 paga R$ 9.500, com um PIX compartilhado ligando as duas → custo do componente sai **R$ 20.000** com `retencaoSobrecobertaCentavos = 0`, quando o número defensável é R$ 19.500 e a contradição de A deveria acender. **Direção do erro: SUPERESTIMA custo**, a única que o §4 do parecer de 17/08 classifica como geradora de passivo tributário — por isso a dívida é nomeada e não só comentada. Duas notas de acompanhamento na mesma dívida, ambas confirmadas como suficientes pelo `cto-obra` no Gate 2: (a) o critério 8 (sobrecobertura) aparece na tela do documento e na célula `Situação` da tabela de Despesas, mas **não** em `ResumoObra.pendencias[]` nem na home — exigiria família nova de `TipoPendencia` e passagem pela régua de gravidade; (b) a transição de `quem_recolhe` de `"nao_sei"` para `"eu"` derruba o custo **retroativamente** e não gera alerta de *"custo declarado precisa de revisão"* quando o ano já foi declarado (ADENDO 3, "nota de acompanhamento, não bloqueante" — a regra fiscal está certa, só falta a UX). | `docs/tickets/CONTAI-056.md` (Gate 2) → comportamento **FIXADO por teste** em `lib/fiscal/vinculo.test.ts`, no caso nomeado *"limitação conhecida D77"* — o teste documenta, não aprova. A correção real exige **modelar valor por vínculo** (`pagamento_documento` com valor, em vez de cobertura por componente), que é mudança de modelo de dados e foi declarada **fora do escopo do `CONTAI-056`** pelo `cto-obra`. Sem ticket ainda; não bloqueante (o caso exige duas notas com retenção confirmada **e** pagamento compartilhado **e** uma delas paga pelo bruto). |

| **D78 — rótulos de escopo que só ficam ambíguos quando a obra cruzar de ano** (data-gatilho **01/01/2027**): (a) "Despesas recentes" da Home fica ancorado no ano real mesmo sob "todos os anos"; (b) "Custo em risco no IR" e "Base de aferição do INSS" são da OBRA INTEIRA enquanto o KPI ao lado é do ANO, e nenhum rótulo diz isso — a partir de 2027 trocar o ano vai mexer num tile e não nos outros dois, na mesma linha da tela; (c) *"apuradas em todos os anos"* em `/pendencias` pode ser lido como "pendências de todos os anos". Nenhum é erro de cálculo: os dois defeitos que ERAM de cálculo (informe do financiamento rebaixado de vermelho para âmbar, e "terreno sem registro" nascendo de filtro de leitura) foram **corrigidos** no Gate 2 do `CONTAI-060`, com a doutrina **"ano fechado × ano corrente é do calendário, nunca da tela"** e travas em `lib/fiscal/resumo.test.ts` | `77-2026-09-26-ano-em-tela-vs-hoje-gate2-contai-060.md` → redação é do `contador` + `designer`; sem ticket ainda, revisar ao entrar em 2027 |
| **D79 — RESOLVIDA no Gate 4 do `CONTAI-065` (26/09)**: `compromisso.documento_origem_id` era write-only — o Mateus afirmava no agendamento (PIX, boleto ou compra no cartão) qual nota originou o compromisso, mas nenhuma quitação propagava esse vínculo para `pagamento_documento` | `78-2026-09-26-cartao-nao-herda-documento.md` → paga parcialmente pelo `CONTAI-064` (herança na captura), por completo pela migration `0020` do `CONTAI-065` (`propagar_vinculo_de_origem`), ver `81-2026-09-26-contai-065-entregue-e-d82-d83.md` |
| **D80 — `favorecido.documento` com máscara gravado por `compra-cartao` antes do `CONTAI-064`**: a tela gravava o CNPJ formatado (`00.000.000/0000-00`) em vez de só dígitos; corrigido no ticket, mas linhas ANTIGAS gravadas em produção antes de 26/09 podem ter ficado com a máscara — se a versão só-dígitos do mesmo documento também existir, duplica favorecido na ficha Pagamentos Efetuados | `79-2026-09-26-contai-064-entregue-e-d80-mascara-favorecido.md` → query de diagnóstico (`select id, nome, documento from favorecido where documento ~ '\D';`) ainda não rodada no banco remoto; se vazia, fecha sem migration; se não, exige merge manual das FKs antes de qualquer UPDATE (unique `(user_id, documento)` barra update cego) |
| **D81 — compra atrasada registrada numa fatura que JÁ TEM um `fatura_desembolso` gravado cria um SEGUNDO desembolso**, duplicando o registro de saída de caixa perante o banco (o custo por pagamento continua correto — cada compra vira 1 pagamento na data certa; o que duplica é só "quanto saiu do banco" na visão da fatura). Achado do `cto-obra` ao avaliar o registro retroativo de compras no cartão, relevante justo para o padrão de backfill compra-a-compra que o Mateus está fazendo agora | `80-2026-09-26-comprovante-fatura-e-agendamento-retroativo-cartao.md` → fora do `CONTAI-066` por disciplina de escopo; candidata a ticket próprio (aviso em `/fatura/[id]/confirmar` quando a fatura já tem desembolso, P complexidade, sem migration, segundo o `cto-obra`); modelar "saldo não alocado" para eliminar de vez é G + migration, só se o `contador` disser que o registro duplicado de saída importa (ainda não avaliado) |
| **D82 — pagamento único que quita DOIS OU MAIS compromissos com `documento_origem_id` DISTINTOS propaga o vínculo só do PRIMEIRO compromisso processado**: a guarda "não sobrescreve" de `propagar_vinculo_de_origem` (migration `0020`) olha o pagamento inteiro, não o par documento-pagamento específico — os demais exigem "Ligar a uma nota" manual. Direção conservadora (nunca infla custo), mas plausível nesta obra (ex.: PIX único cobrindo duas parcelas agendadas do empreiteiro com notas distintas) | `81-2026-09-26-contai-065-entregue-e-d82-d83.md` → solução futura é provenance por linha em `pagamento_documento`, estrutura nova fora do escopo do `CONTAI-065`; sem ticket ainda |
| **D83 — `pagamento.status` diverge do vínculo no caminho propagado pelo `CONTAI-065`**: fica `aguardando_nf` mesmo já tendo nota hábil ligada — o vínculo manual via `criarVinculos` seta `status = 'conciliado'` como consequência, a propagação automática da migration `0020` não | `81-2026-09-26-contai-065-entregue-e-d82-d83.md` → confirmado pelo `contador`/`cto-obra` sem impacto fiscal (nenhum código em `lib/fiscal/vinculo.ts`/`resumo.ts` lê essa coluna); decidir no futuro entre aposentar a coluna ou centralizar a derivação de status, nunca remendar direto na RPC (duplicaria o predicado `ehDocumentoHabil` em SQL); sem ticket ainda |
| **D84 — multicartão com o mesmo vencimento colapsa num único `extrato_path`**: o risco residual já aceito na `0013` (dois cartões, mesmo vencimento = uma `fatura`) passa a ter custo documental concreto com o `CONTAI-067` — um campo só para dois PDFs de administradoras distintas | `82-2026-09-26-contai-067-extrato-da-fatura-e-correcao-contai-066.md` → correção aditiva (rótulo do cartão na chave única) só se acontecer de verdade; não modelada agora |
| **D85 — não existe leitor "todas as faturas da obra"** (`carregarFatura` é singular, uma por vez) — pré-requisito técnico da fila unificada de pendências que o `CONTAI-067` propõe | `82-2026-09-26-contai-067-extrato-da-fatura-e-correcao-contai-066.md` → `carregarFaturas(obraId)` nasce dentro do próprio `CONTAI-067` (critério 15) |
| **D86 — anexo do extrato da fatura (`CONTAI-067`) não ganha rastro formal em `revisao`**: decisão deliberada (sem impacto em apuração de custo/aferição, sem "anos afetados" a rastrear) | `82-2026-09-26-contai-067-extrato-da-fatura-e-correcao-contai-066.md` → se o `contador` exigir rastro explícito de "quando" no futuro, `entidade_revisao` (ENUM) precisa de `alter type add value` em migration própria, separada |
| **D87 — não existe estado `formato_invalido` separado para o CNO cadastrado da obra fora do padrão de 12 dígitos** (`CONTAI-069`): hoje um cadastro histórico com 11/13+ dígitos cai no mesmo veredito `"diverge"` de uma nota com CNO genuinamente diferente — o `contador` sugeriu distinguir os dois casos como possível melhoria futura, não como bloqueio deste ticket | `86-2026-09-27-contai-069-entregue.md` → sem ticket ainda, sem prioridade do Mateus; a mitigação atual (mostrar os dois números sempre que houver leitura) já torna o sintoma visível, então não é bloqueante |
| **D88 — `/\bIR(RF|PJ)?\b/i` (categoria `irrf` de `lib/extracao/tributo-rotulo.ts`) é case-insensitive numa sigla de só 2 letras**: casaria o verbo comum "ir" (ex. um rótulo hipotético "Valor a ir" sugeriria IRRF por engano). Achado do `cto-obra` no Gate 2 do `CONTAI-070`, não-bloqueante: o rótulo ainda precisa fechar a aritmética total−líquido do parser e passar pelo veto de `RE_NAO_TRIBUTARIO` antes de chegar a este classificador, então o risco prático é baixo | `87-2026-09-27-contai-070-entregue.md` → sem ticket ainda; é vocabulário de classificação fiscal (a sigla "IR" nua deveria virar case-sensitive), exige olhar do `contador` antes de mexer na regex |

O status de cada uma está na própria entrada — este índice aponta, não duplica.

---

## Entradas do diário (ordem cronológica de registro)

### `01-2026-08-08-gate4-contai-001.md` — 136 linhas
**Gate 4 do CONTAI-001 — 2026-08-08 — validação do PO**
- Fila recomendada pelo PO
- Novos tickets / stories
- Risco de projeto (não é feature, mas é decisão de priorização)
- Ajustes em itens existentes
- Cortado no Gate 4 (com justificativa)

### `02-2026-08-07-relato-001.md` — 161 linhas
**Relato 001 — 2026-08-07 — "Planilha, agenda e o medo do IR"**
- Dores extraídas
- Hipótese de solução do usuário (não é requisito)
- User stories
- Ação imediata (antes de qualquer código)
- Cortado (com justificativa)
- Perguntas respondidas (2026-08-07)

### `03-2026-08-07-relato-002.md` — 69 linhas
**Relato 002 — 2026-08-07 — "PIX mensal pra AJE, nota depois (talvez única)"**
- Dores extraídas
- User stories
- Ação do Mateus (fora do app)
- Perguntas fechadas pelo contador (2026-08-08, review fiscal do CONTAI-001)
- Perguntas abertas

### `04-2026-08-08-gate2-contai-001.md` — 60 linhas
**Gate 2 do CONTAI-001 — 2026-08-08 — reviews aprovados com ressalvas**
- Novos tickets propostos (a priorizar pelo Mateus)
- Requisitos anotados em stories existentes

### `05-2026-08-09-relato-003.md` — 446 linhas
**Relato 003 — 2026-08-09 — "Duas obras ao mesmo tempo: uma para vender, outra para morar"**
- Dores extraídas
- Hipóteses do relato que **não** viraram requisito
- O que o contador respondeu (parecer 2026-08-09)
- Tickets criados
- Fila revista — 2026-08-09 (1ª revisão) — **SUPERADA**
- Novas stories
- Ajustes em stories existentes
- Perguntas Q11–Q13 — respondidas pelo Mateus em 2026-08-09
- 2º parecer do contador — 2026-08-09 — obra em andamento SEM CNO
- Fila revista — 2026-08-09 (2ª revisão, depois das respostas Q11–Q13)
- Por que a fila mudou (e o que eu errei antes)
- Dores novas, extraídas das respostas de 2026-08-09
- Ajustes adicionais em stories existentes (2026-08-09, 2ª revisão)
- Perguntas e riscos que o 2º parecer abriu (não viram requisito hoje)
- Cortado (com justificativa)

### `06-2026-08-10-gate2-contai-003.md` — 304 linhas
**Gate 2 do CONTAI-003 — 2026-08-10 — reviews aprovados com ressalvas**
- A ressalva bloqueante que caiu — o backfill de `data_inicio_obra`
- Dores extraídas das ressalvas
- Tickets criados
- Acrescentado ao CONTAI-007 (sem ticket novo)
- Dívidas nomeadas do CONTAI-003 (nenhuma segura o Gate 2)
- Fila revista — 2026-08-10 (3ª revisão)
- O que mudou em relação à 2ª revisão, e por quê
- Cortado no Gate 2 (com justificativa)
- Fila revista — 2026-08-16 (4ª revisão)
- O que mudou em relação à 3ª revisão, e por quê
- Achados de 2026-08-16 que viram item de backlog

### `07-2026-08-16-gate4-contai-002.md` — 213 linhas
**Gate 4 do CONTAI-002 — 2026-08-16 — DONE COM RESSALVAS**
- Aprovação do Mateus registrada neste gate (escopo exato)
- Tickets novos propostos (precisam passar pelo `/tickets-req`)
- Decisão tomada no gate (não vira ticket)
- Dívidas da implementação fora de ordem (002 antes de 004, 007 e 009)
- Ressalvas R5–R7 do Gate 4 do CONTAI-002 — gravadas em 2026-08-17
- Fila revista — 2026-08-17 (5ª revisão)
- O que mudou, e por quê
- ⚠️ O CONTAI-007 precisa de revisão antes do `/develop` — seis pontos
- Migrations: uma por ticket

### `08-2026-08-17-incidente-producao-e-fila-vigente.md` — 283 linhas
**Incidente de produção — 2026-08-17 — `permission denied for table obra`**
- O achado de processo — a regra de E2E contra o Postgres local tem ponto cego
- Fila revista — 2026-08-18 (6ª revisão) — **SUPERADA**
- US-002 — REESCRITA, não fundida
- O que o uso real produziu em 24 horas
- Dores levantadas no Gate 2 do CONTAI-018 (2026-08-18)
- Dores da correção de documento — 2026-08-18 (origem: adendo + commit `b807901`)

### `09-2026-08-18-d31-regime-de-caixa.md` — 70 linhas
**D31 — "regime de caixa" ainda em três telas que o CONTAI-019 não tocou**

### `10-2026-08-18-dividas-gate2-contai-019.md` — 121 linhas
**Dívidas nomeadas no Gate 2 do CONTAI-019 — 2026-08-18**
- D28 — a tela promete que o relatório trava, e hoje nada trava
- D29 — `getByRole(..., { name })` sem `exact` erra na direção de APROVAR
- D30 — `pagamento_diferenca` aceita UPDATE no valor, e não deveria
- D32 — enum fiscal sem contrapartida no parecer é classe, não incidente

### `11-2026-08-18-terreno-financiado.md` — 67 linhas
**Terreno financiado — 2026-08-18 (absorvidas pelo `CONTAI-010`)**

### `12-2026-08-19-gate1-contai-021.md` — 56 linhas
**Gate 1 do `CONTAI-021` — 2026-08-19 — quatro decisões de escopo do `po` + um achado de código**
- D19 volta à vida — e o `CONTAI-008` foi reaberto

### `13-2026-08-21-gates2-4-contai-021.md` — 110 linhas
**Gates 2 a 4 do `CONTAI-021` — 2026-08-21 — o que ficou em pé, e onde**
- R1 — o array do move aceita duplicata e aceita ato contraditório
- R2 — `alocarCusto` deveria REPORTAR o vínculo órfão, não engoli-lo
- R3 — três dívidas menores, todas do `CONTAI-008`
- R4 — pendência do `contador`, e ela morde a META 2, não este ticket
- R5 — `p_depois is null` recusado, ratificado com validade condicionada
- Achado do Gate 3 (já consertado, `e517cc2`)
- Flake conhecido, para não virar caça a fantasma
- Dores novas achadas no Gate 4 do `CONTAI-021` — 2026-08-21

### `14-2026-08-21-relato-004.md` — 75 linhas
**Relato 004 — 2026-08-21 — *"eu fiz mais de uma transferência"***
- ⚠️ A dor relatada NÃO é a dor do caso dele — e as duas são diferentes
- Fato da obra registrado (para não ser reperguntado)
- Dores extraídas
- O que este relato NÃO virou requisito, e por quê
- D35 sai da lista de dores sem ticket

### `15-2026-08-21-adjudicacao-fiscal-contai-027.md` — 103 linhas
**Adjudicação fiscal do `CONTAI-027` — 2026-08-21 — o critério 13 cai, e três coisas mudam de dono**
- O que aconteceu, e por que fica registrado
- O argumento que está PROIBIDO de voltar
- Regra geral nova, que vale para toda pendência futura
- D39 — a regra de cor mudou, e a decisão é do `po`
- Ticket novo a criar — correção de valor de desembolso do terreno
- O que ficou mais fraco, dito por extenso

### `16-2026-08-22-custo-de-contexto-do-pipeline.md` — 86 linhas
**Custo de contexto do pipeline — 2026-08-22 — o `/develop` estava pagando a mesma leitura N vezes**
- O que foi medido (2026-08-22)
- As quatro causas, e o conserto de cada uma
- Este arquivo é consequência do item que sobrou
- D40 — `lib/data.ts` com 2065 linhas é o custo que sobrou
- O que este item NÃO é

### `17-2026-08-22-o-que-a-extracao-dos-specs-achou.md` — 82 linhas
**Auditoria não planejada — 2026-08-22 — extrair spec dos mocks virou revisão de texto fiscal**
- O achado grave: erro fiscal **em produção**
- O erro estava no PARECER também — e a ordem de conserto importa
- Os outros quatro achados, todos ainda abertos
- A lição de processo

### `18-2026-08-23-gate4-contai-028-fatia1.md` — 147 linhas
**Gate 4 do `CONTAI-028` — 2026-08-23 — fatia 1 ACEITA, ticket segue ABERTO**
- O que este gate provou por conta própria (não por relato)
- Dois números do ticket que estavam errados, e devem ser corrigidos
- Os critérios que NÃO fecham com a fatia 1
- Os dois desvios, julgados
- Prioridade — as fatias 2-7 VOLTAM PARA O FIM DA FILA
- O preço de parar na fatia 1, dito por extenso
- Pendências que este gate abre
- D40 — status

### `19-2026-08-23-duas-condicoes-fiscais-sem-rede.md` — 96 linhas
**Duas condições fiscais sem rede — 2026-08-23 — achado do Gate 2 do `CONTAI-029`**
- D42 — a condição 6 não tem rede NENHUMA, nem unitária nem E2E ⚠️
- D43 — o formato do rastro é uma expressão anônima dentro de uma RPC
- O mapa que sobrou: 10 das 16 condições só têm E2E
- A correção da condição 4, e o erro era de redação

### `20-2026-08-23-gate4-contai-029.md` — 88 linhas
**Gate 4 do `CONTAI-029` — 2026-08-23 — ENTREGUE, com um critério reescrito**
- O critério 4 estava errado (pedia bug); reescrito em 4a/4b
- O critério 2 era literalmente impossível — o mapa das 16 condições vale mais
- Duas ressalvas que viram trabalho de outro ticket
- O que este gate decidiu sobre a fila: **D42 → `CONTAI-031` P1**, D43 dividida
- Redação proposta para o Gate 4 do `develop.md`

### `21-2026-08-23-setima-revisao-da-fila.md` — 206 linhas
**7ª revisão da fila — 2026-08-23 — a primeira que não mora aqui**
- O que mudou em relação à 6ª revisão, e por quê (sete movimentos)
- ⛔ A ordem do release foi invertida — `0009`/`0010` e código já pushado
- 🕯️ D44 — default em campo fiscal, em produção
- O que eu cortei, e por quê · a dívida da premissa de 18/08, PAGA caso a caso
- O que continua parado esperando o Mateus · o que a revisão NÃO fez

⚠️ **A ordem NÃO está nesta entrada** — está em `docs/tickets/README.md`.

### `22-2026-08-23-adendo-a-setima-revisao.md` — 219 linhas
**Adendo à 7ª revisão — 2026-08-23 — o parecer chegou no mesmo dia e mudou quatro postos**
- Por que é adendo e não 8ª revisão (o teste: revisão reexamina tudo; adendo aplica um fato)
- Os quatro movimentos — `025` sobe a pré-requisito, `032` nasce, `022` mantém o posto com o **diagnóstico corrigido**, `008` destrava no fiscal e **não sobe**
- O `032` continua **P0**, por três razões (ano, entidade, guarda desativada) — mudou o custo, não a gravidade
- A metade `meio` do `032` não depende do `025` — **linha do `contador`**, não do `po`
- O achado de processo: **`po` não emite condição fiscal** — redação proposta para o `/tickets-req`
- O que este adendo NÃO fez

### `23-2026-08-23-gate4-contai-027.md` — 118 linhas
**Gate 4 do CONTAI-027 — 2026-08-23 — PASS COM RESSALVA**
- Placar (20 PASS · 1 PENDENTE · 1 CORTADO) e o que foi **reverificado**, não herdado — 488 unitários e 132 E2E rodados no gate
- O ruído de ambiente do Kong que reprovou 38 testes e **não é código**
- **D47** — a pergunta pendente sem superfície, e a justificativa da escrita não-atômica que invoca tela inexistente
- **D48** — frase fiscal no critério 12b **sem parecer que a carimbe** (D46 invertida); a varredura da D46 passa a ter **duas** ofensoras
- A lição de processo: *"Gate 1 não é fim de nada"* é necessária e **insuficiente** — as quatro recomendações, sendo a primeira **tirar o `git push` do Gate 1**
- Pré-autorização de revisor **adjudicada**, com a fronteira escrita

### `24-2026-08-23-relato-005.md` — 328 linhas
**Relato 005 — 2026-08-23 — *"fui bloqueado pelos comprovantes e daí parei de usar"*** ⚠️ **o Mateus abandonou o app**
- A dor relatada não é a dor — e o texto de bloqueio citado é de **outra entidade**
- A régua que faltava: anexo-**PROVA** × anexo-**FONTE**, e o teste de duas perguntas
- **Inventário das 6 superfícies de registro**, com veredito uma a uma (2 já certas, 2 liberar, **2 mantêm a recusa**)
- Dores **D49–D52** · US-A a US-E · o que eu **recusei** ao Mateus, contra o pedido explícito dele
- Fato da obra: **parte dos desembolsos do terreno saiu da conta do cônjuge**
- Achado de processo: a **D46 tem terceira ofensora**, e duas lições novas (critério que **viaja entre entidades**; **falta de inventário** de regra transversal)

---

### `25-2026-08-23-a-regua-de-cor-e-o-que-ela-escondia.md` — 92 linhas
**A régua de cor — 2026-08-23 — seis pendências com o dinheiro fora do bolso pintadas de âmbar**

- A D39 revisada — binária, com o eixo que faltava
- O inventário — 13 call sites em 5 arquivos
- A divergência com o `designer`, e como ela fechou
- O que ficou para o `designer`, e é dele
- D54 — a régua não tem gate

### `27-2026-08-24-defeito-vivo-composicao-material-mao-de-obra.md` — 52 linhas
**Defeito vivo em `composicaoDaDiscriminacao` — 2026-08-24 — achado ao construir o CONTAI-036**

- O defeito, tal como o `contador` nomeou
- Por que não foi corrigido no `CONTAI-036`
- D55 — a dívida

### `28-2026-08-24-gate4-contai-036.md` — 83 linhas
**Gate 4 do CONTAI-036 — 2026-08-24 — a primeira saída anual do produto fecha**

- Os 16 critérios originais — todos PASS (crit. 13d: prova em Vitest, não E2E)
- Dois critérios novos (15, 16) — retrofit pela régua do CONTAI-004: composição
  material×mão de obra por ano, e a marca da porta não pode ser forjada
- As três perguntas do gate — entregue? dor resolvida? critérios retroativos?
- O que não foi reaberto: critério 3, D55
- Pendência: `docs/tickets/README.md` ainda não tem linha própria do `036`
  (falta hash — diff não commitado)

### `29-2026-08-24-reconciliacao-contai-009.md` — 78 linhas
**Reconciliação do CONTAI-009 — 2026-08-24 — o ticket já foi implementado por baixo do nome de outro**

- O achado: `/pagamento/[id]` já existe em produção, construído como critério 3
  do `CONTAI-018` (incidente independente, 18/08), sem citar o CONTAI-009 —
  que não aparece em lugar nenhum de `docs/tickets/README.md`
- Verificação critério a critério do CONTAI-009 contra o código de hoje
- As 4 decisões do designer (mock `CONTAI-009.md`): lista do grupo CORTADA
  (já resolvida por outro caminho), vocabulário do chip = o do mock (já em
  produção), anexar comprovante que falta = fora de escopo (**D56** nova),
  pagamento conciliado sem porta = opção (a), lacuna REAL verificada
- Critérios 2/5 reescritos e critério 8 novo, prontos para colar
- Recomendação: fechar CONTAI-009 como SUPERADO pelo CONTAI-018; migrar o
  critério 8 para ticket pequeno (S)

### `30-2026-09-19-retencao-variavel-servico-pj.md` — 30 linhas
**Retenção variável em NF de serviço PJ — 2026-09-19 — "cada um tem a sua, portanto eu acho que tem ser um input"**

- Pedido original (input de %) recusado pelo `contador`: para tomador PF a
  retenção do art. 31 não existe em nenhum percentual — o parecer não podia
  validar a premissa
- Nota real do Francisco quebra a premissa de campo-por-tributo: é uma linha
  única "Total das Retenções (ISSQN / Federais)", combinada
- ADENDO 2026-09-19: estrutura vira lista de 1..N linhas de retenção por
  documento (rótulo literal, valor, `composicao`, `e_desconto_efetivo`);
  `documento.retencao11: boolean` sai do schema
- Parecer: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`

### `31-2026-09-19-sequenciamento-contai-035-038.md` — 60 linhas
**Sequenciamento CONTAI-035 × CONTAI-038 — 2026-09-19 — o item F recolore uma pendência que o parecer manda apagar**

- O conflito: item F do `CONTAI-035` (aprovado) recolore `servico_sem_retencao`;
  o `CONTAI-038` apaga essa pendência inteira por premissa fiscal corrigida
- Decisão do `po`: item F sai do escopo do `035` agora (critérios 8/9/13
  ajustados) — recolorir o que vai ser apagado é trabalho descartável, não
  adiável
- Ordem da fila: `CONTAI-035` (sem item F) ANTES do `CONTAI-038`, porque o
  `035` cria `gravidadeDaRegua`/`lib/fiscal/gravidade.ts` (único produtor de
  cor) e a pendência nova do `038` (`retencao_sem_recolhedor`) deve nascer já
  usando esse produtor — sujeito à confirmação do `cto-obra`
- **D57** — nova dívida: falta o campo "mão de obra declarada no CNO?", o
  único que abate o SERO; confirmado por busca que não existe em lugar nenhum

### `32-2026-09-19-cta-documentos-sem-arquivo-contai-033.md` — 24 linhas
**CTA "Ver os documentos" do card agregado — CONTAI-033 — 2026-09-19**

- Decisão do `po`: sem lista de documentos nova. `href = /documento/[id]`
  quando `quantidade === 1`; `href = null` (sem CTA) quando `quantidade > 1`
- Justificativa pelo filtro das 3 metas: obrigação fiscal já coberta pelo
  card + veto do critério 11; lista filtrada seria fricção de processo, fora
  do necessário para fechar as três guardas
- Corte deliberado, não bloqueante: lista própria vira ticket P2 se o volume
  de pendências simultâneas justificar

### `33-2026-09-20-tres-bugs-achados-no-teste-manual-do-contai-033.md` — 60 linhas
**Três bugs achados no teste manual no browser do CONTAI-033 — 2026-09-20 — o mesmo teste que já pegou o CONTAI-022**

- Achados DEPOIS dos Gates 1 e 2 fechados (639 unitários + 179 E2E verdes):
  confirmação de sucesso mentindo "Arquivo guardado no acervo" sem arquivo
  nenhum; home dizendo "Nenhuma pendência" com pendência vermelha na mesma
  tela; "sem pagamento ligado" chamando de quarentena uma nota que nunca
  esteve fora do CPF
- Os três corrigidos no próprio CONTAI-033, com E2E travando a regressão
- **D58** — o mesmo bug da confirmação existe em `/adicionar/pagamento`
  (ticket anterior, não corrigido aqui)
- **D59** — o banner "Nenhuma pendência" só foi corrigido para
  `documentosSemArquivo`; os outros cinco agregados "fora de pendencias" não
  foram auditados

### `34-2026-09-20-contai-008-entregue.md` — 30 linhas
**CONTAI-008 entregue — 2026-09-20 — mover pagamento entre obras vira ato transacional**

- Espelho do CONTAI-021 (lado do documento): migration 0016, `ato_id`
  compartilhado, decisão por documento (vai_junto/fica_na_origem), guarda de
  contagem também em `mover_documento_de_obra`. `corrigir-obra.tsx` (órfão)
  apagado
- Gate 2 aproveitou a correção fiscal do CONTAI-007 — a leitura de 24/08 da
  pergunta 1/critério 16 (bloquear por CNO divergente) estava errada; a
  implementação já nasceu com a leitura vigente (aviso, nunca bloqueio)
- 687 unitários + 202 E2E + validação manual no browser (duas obras, CNO
  diferentes, move com aviso preservando o vínculo)
- **D60** — `HistoricoDeCorrecoes` só renderiza em `/documento/[id]`; mover um
  PAGAMENTO não aparece em tela nenhuma pelo lado do pagamento (nem na nota
  que "fica", nem em `/pagamento/[id]`, que não tem histórico algum). Nada
  fiscal fica mudo (pendência visível em `/pendencias`), mas o rastro fica
  invisível na tela errada

### `35-2026-09-20-discriminacao-veto-transversal-teste-flaky.md` — 35 linhas
**`e2e/discriminacao.spec.ts:215` vermelho — é o teste, não o veto fiscal (correção de diagnóstico do Gate 2 do CONTAI-005)**

- O `cto-obra` achou o teste vermelho na árvore pré-CONTAI-005 e concluiu
  "veto transversal do CONTAI-036 não dispara — erro fiscal P0 em produção".
  **Diagnóstico errado, investigado e corrigido**: `podeGerarRelatorioAnual`
  está certo (40+ testes unitários verdes); o bug é o helper do E2E
  calculando "ontem" com `toISOString()` (UTC) em vez do fuso local que
  `hojeIso()` usa — falha só entre ~21h e 23h59 local, quando o dia UTC já
  virou e "ontem" em UTC vira "hoje" em local
- **Não é dívida fiscal (sem D-número)**: nenhum defeito de produto. Correção
  sugerida é uma linha no teste, sem parecer do `contador` nem ticket próprio

### `36-2026-09-20-contai-005-entregue.md` — 25 linhas
**CONTAI-005 entregue — 2026-09-20 — headline "Custo em risco no IR" com três parcelas**

- `emPendenciaCentavos` (quatro moedas fiscais somadas) removido; entram
  `custoEmRiscoIr` (3 parcelas: pago sem nota, nota fora do CPF, pago sem
  comprovante) e `exposicaoInssBaseCentavos` (base do INSS, deduplicada por
  `documento.id`)
- Gate 2 fiscal decidiu duas lacunas do mock original de 16/08: "pago sem
  comprovante" entra no headline (mesma moeda, art. 17); `nf_servico_sem_cno`
  entra na base de INSS sem contar em dobro documento com duas pendências
- 712 unitários + 201/202 E2E (falha restante é do teste, não fiscal — `35`)
- **D61** — `terrenoPagoSemComprovante` continua fora do headline por corte de
  escopo herdado (CONTAI-010/025), mas é a MESMA moeda que acabou de entrar;
  terreno + obra são o mesmo bem. Headline hoje subestima a exposição real.
  Precisa de decisão de arquitetura do `cto-obra` (unificar duas pipelines de
  agregação) — ticket próprio, fora do CONTAI-005

### `37-2026-09-20-contai-035-entregue.md` — 25 linhas
**CONTAI-035 entregue — 2026-09-20 — D39 revisada reconciliada com todos os call sites**

- `gravidadeDaRegua(...)` (`lib/fiscal/gravidade.ts`) vira único produtor de
  `Gravidade` branded; zero literal de cor sobrevive fora do módulo (D54)
- Item C tinha **9 sites, não 7**: os 2 a mais (`app/pagamento/[id]/obra`)
  nasceram no CONTAI-008, depois do inventário de 23/08 que gerou este
  ticket — achado no Gate 1, aceito por `cto-obra` e `contador` no Gate 2
- 742 unitários (30 novos) + 203/204 E2E (falha pré-existente não-fiscal, `35`)
- Sem dívida fiscal nova. Nota para o futuro: **telas espelhadas
  (documento↔pagamento) precisam ser conferidas juntas** quando um ticket
  novo tocar uma régua fiscal — a espelhada pode ter nascido depois do
  inventário original

### `38-2026-09-21-contai-038-entregue.md` — 30 linhas
**CONTAI-038 entregue — 2026-09-21 — retenção de NF de serviço PJ vira lista de linhas**

- `retencao_11` (booleano fixo de 11%) sai do schema; entra o gate
  `retencao_na_nota` (captura) + tabela `documento_retencao` (repeater na
  gestão, inédito no produto). `retencao_sem_recolhedor` é a primeira
  pendência que AGRAVA a régua (âmbar→vermelho), não abranda
- `lib/fiscal/risco.ts`/`afericao.ts` pararam de ler retenção para decidir
  abatimento do SERO (§2 do parecer de 18/09 — a base nunca foi reduzida pela
  retenção, só pela mão de obra vinculada ao CNO, D57). Exposição de INSS cai
  na home; é o efeito correto
- `documento_retencao` ganhou DELETE (decisão do `cto-obra`) — é afirmação do
  Mateus sobre o papel, não acervo com arquivo no bucket
- 791 unitários + 217/217 E2E + validação manual no browser
- **D62** — correção do valor do gate (`retencao_na_nota`) sem caminho pela
  interface; aceitável (pendência âmbar nomeada, não risco silencioso)
- **D63** — correção de `rotulo_literal`/`valor` de linha já gravada sem
  caminho pela interface; mesma categoria de D62, mesmo caminho futuro
  (extensão de `corrigir_documento`)

### `41-2026-09-21-contai-037-entregue.md` — 20 linhas
**CONTAI-037 entregue — 2026-09-21 — porta para o pagamento conciliado a partir do documento**

- `BotaoLink` "Ver o pagamento" em cada linha de "Pagamentos desta nota"
  (`/documento/[id]`), simetria literal com "Ver o documento" já existente
  em `/pagamento/[id]`. Reusa `alocado.pagamentos`, sem segunda derivação
- Sem regra fiscal nova (Gate Fiscal fechado, automático); segunda porta de
  leitura para dado já calculado
- 839 unitários + 240 E2E (novo teste prova que o clique na 2ª linha abre o
  pagamento clicado, não o primeiro) + validação manual. Gate 4 (`po`) PASS
- Sem migration, sem dívida nova. **Fecha a fila ativa do índice de tickets**

### `40-2026-09-21-contai-034-entregue.md` — 32 linhas
**CONTAI-034 entregue — 2026-09-21 — a D44 vira trava executável**

- `data-campo="<id do mock>"` amarra `design/mocks/*.md` a todo controle
  fiscal; `lib/design/campos-do-spec.ts` parseia `## Campos` **fail-closed**
  (linha fora da gramática = suíte vermelha, nunca ignorada); `e2e/campos-
  fiscais.spec.ts` cruza spec × DOM e exige toda rota classificada
- **Provado contra a D44 real**: `useState(hojeIso)`/`useState("pix")`
  reintroduzidos em `/adicionar/pagamento` deixam a suíte vermelha nomeando
  `fData` e `meio`; revertido, volta a verde — checado manualmente no Gate 4
- Cobertura é só das 9 rotas que a suíte abre; falso negativo assumido e
  escrito no teste (mesmo desenho do `privilegios.spec.ts`)
- 839 unitários (22 novos) + 239 E2E (19 novos) + validação manual
- **D65** — `cValor` pré-preenchido em `/compromisso/[id]/confirmar` (mesma
  forma da D44); corrigido dentro do próprio ticket por decisão do
  `contador` no Gate 2, não em ticket separado — mas só documentado em
  comentário de código até esta entrada
- **D66** — `unidades_autonomas` nasce `"1"` contra `SEM DEFAULT` do
  `CONTAI-003`; achada, não corrigida (passo 4 do assistente, fora da visita
  da suíte) — falta ticket

### `44-2026-09-21-contai-039-entregue.md` — 30 linhas
**CONTAI-039 entregue — 2026-09-21 — home ganha layout desktop**

- A partir de `lg` (1280px): `<aside>` sticky com a posição fiscal à
  esquerda, fila de pendências/despesas em grid 2 colunas à direita, mesma
  ordem fiscal de sempre. Abaixo de `lg`, idêntico ao mobile de hoje
- Gate 2 achou bug real (não hipotético): aside sticky escondia
  `CardAfericaoInss` quando a régua era mais alta que a viewport — corrigido
  com scroll próprio (`lg:max-h-full lg:overflow-y-auto`)
- Segundo achado: `lg:max-w`/`BarraAdicionar` não podiam ser globais (as
  outras 43 telas ficariam com `Consequencia` menos legível). Virou opt-in
  por página (`Corpo largo?`, `data-largo`, `alinharComFila`) — elimina o
  efeito, **D67 nunca chegou a ser registrada**
- 839 unitários + 242 E2E (240 mobile + 2 desktop) + validação manual no
  browser. Gate 4 (`po`) PASS, 12/12 critérios. Sem migration
- Fica para rodada futura: estender `aside`+`Secao` a `/documento/[id]`,
  `/pagamento/[id]` e correção (Out of Scope deliberado, não regressão)

### `43-2026-09-21-convergencia-home-desktop.md` — 62 linhas
**Convergência home desktop — 2026-09-21 — `designer` + `cto-obra` + `po` fecham o Conceito 2 ("Régua fixa + fila de trabalho")**

- A dor: a casca trava em `max-w-[430px]` mesmo nas telas de **gestão**
  (cenário principal do produto desde a correção de 2026-08-18 do
  `CLAUDE.md`) — na home, isso obriga rolar para longe da régua fiscal
  enquanto se revisa a fila de pendências
- Escolhido: coluna esquerda `sticky` com a posição fiscal (4 blocos),
  coluna direita com a fila em grid de 2 colunas a partir de `lg`, cards
  inteiros (sem truncar `Consequencia`), piso de 375px intocado
- Cortes do `cto-obra`: **sem abas por tipo** (esconderia pendência atrás de
  clique) e **sem scroll independente como requisito** (fica só como
  fallback se a régua crescer)
- Vira **`CONTAI-039`**, escopo travado à home; bloqueado por `/design`
  antes do Gate 1 (valor de `lg:max-w`, partição do grid, alinhamento da
  `BarraAdicionar` — literais demais para esta convergência)

### `39-2026-09-21-contai-006-entregue.md` — 30 linhas
**CONTAI-006 entregue — 2026-09-21 — estados de rede lenta e indisponível**

- Política de rede única (`lib/rede.ts`), `db.retry:false` desligando o retry
  nativo do postgrest-js. Leitura: 3 tentativas, teto de 5s, texto reflete a
  falha real a partir da 1ª tentativa (nunca "carregando" depois de saber que
  falhou). Gravação: 1 tentativa, nunca repetida, teto de 10s, distingue
  "não foi salvo" (resposta recebida) de "não deu para confirmar" (sem
  resposta — manda conferir antes de repetir, para não duplicar)
- Gate 2 (`cto-obra`) APPROVE com 1 rodada de rework (aviso de "sem resposta"
  disparava também em escrita — falso; movido para dentro do ramo repetível).
  Decisão sobre a tensão critério 3×8: teto de leitura se prova por unitário
  com relógio injetado, não por rota que pendura em E2E — só o 503 do
  PostgREST continua permitido como falsificação de rede em E2E
- 817 unitários + 220/220 E2E + validação manual no browser (Postgres
  pausado/despausado nos 4 estados, textos exatos do spec confirmados)
- Sem migration
- **D64** — upload ao Storage sem teto próprio (pode durar até o timeout TCP
  do browser); não duplica nada, não bloqueou o ticket. Caminho futuro: teto
  via `AbortSignal` no `.upload`, mesmo texto de resultado incerto do critério 6

### `57-2026-09-22-fix-scroll-travado-shell-mobile.md` — 40 linhas
**Fix: scroll do shell travava antes do fim em telas estreitas — 2026-09-22**

- Relato do Mateus com print (`/obras/[id]/terreno/desembolsos`); mais
  grave que parecia: o formulário "Registrar um desembolso" ficava
  inacessível em qualquer tela migrada nos `043`-`046` com conteúdo longo
- Causa 1: coluna do shell sem `min-h-0` crescia além do `h-dvh`, e o
  `<main overflow-y-auto>` ficava sem nada pra rolar — a PÁGINA tentava
  rolar em vez dele. Só aparecia abaixo de `lg` (em `lg` o `stretch` já
  limitava), por isso atravessou os 4 tickets sem ninguém notar
- Causa 2: rádio `sr-only` de `Escolha` (`campos.tsx`) sem ancestral
  posicionado escapava do `overflow-hidden` e esticava o documento inteiro
- Bônus: cards de anexo alinhados pelo centro (`items-center`), não mais
  pelo topo
- Guarda geométrica nova (mede quem rola, não usa `click()`), provada
  não-vacuosa. `cto-obra` APPROVE. Sem regra fiscal tocada

### `58-2026-09-22-captura-tela-larga-contai-047-048.md` — linhas ver arquivo
**Captura ganha tela larga — 2026-09-22 — resposta à pergunta 2 do `45-…`**

- O Mateus respondeu: a permissão de tela larga vale também para
  `/adicionar/*` (captura), não só para as telas de gestão — viu
  `/adicionar/documento` esticada sem aproveitar a largura, no uso real dele,
  majoritariamente desktop
- Consulta técnica ao `cto-obra` **rejeita mover `/adicionar/*` para
  `(gestao)`**: traria chrome de gestão para dentro do canteiro, duplicaria
  "obra ativa" (`useGestao` × `useObraDoRegistro`), reabre o Pre-mortem 3 do
  `CONTAI-040`. Recomenda casca larga própria em `(captura)` (~720px, campos
  escalares em grid, bloco de pergunta fiscal em coluna única)
- Dois tickets, nenhum bloqueia o outro: **`CONTAI-047`** (casca larga,
  reflow puro, P1) e **`CONTAI-048`** (achado à parte do `cto-obra`: anexo
  visível ao lado do formulário durante a extração — feature nova, não
  bloqueante, sem mock ainda)
- Nenhuma migration. `e2e/shell-desktop.spec.ts` precisa de asserts de
  largura atualizados (assert de ausência de `[data-shell]` não muda)

### `59-2026-09-22-decisao-po-mock-captura-desktop.md` — 60 linhas
**Decisão do `po` sobre o Gate 0 de captura desktop — 2026-09-22 — reconciliação entre `CONTAI-047`/`048` e o mock do `designer`**

- O `po` escreveu `047`/`048` sem ver o Gate 0; o `designer` publicou
  `design/mocks/captura-no-desktop-v1.md`/`.html` em paralelo. Cinco pontos
  de divergência fechados no mesmo dia
- O rail do mock (miniatura 52×52 + resumo somente-leitura) é reflow, não a
  feature do `048` (render legível do documento) — entra no `047`
  (critério 1a); `048` continua sem Gate 0, fronteira escrita nos dois
  tickets
- Takeover de tela cheia confirmado com o `cto-obra`: navegação normal entre
  `(gestao)`/`(captura)`, layouts irmãos, zero código novo
- Largura do grupo sobe de 720px (sugestão original, sem rail) para ~900px
  (com rail). **D68** nova (inconsistência pré-existente "Passo 2 de 3"/
  "Passo 3 de 3"). Rail não se estende a `pagamento`/`compra-cartao`
- `CONTAI-047` sai de "bloqueado por Gate 0" e entra pronto para `/develop`

### `56-2026-09-22-fix-overflow-faixa-mobile-ci.md` — 30 linhas
**Fix: overflow da faixa mobile escondia "+ Novo registro" — 2026-09-22**

- CI vermelho desde o `CONTAI-040` (5 runs), passava local no Mac: fonte de
  fallback do Linux + badge de 2 dígitos estourava a faixa de 375px,
  empurrando "+ Novo registro" para fora da área visível
- Causa: o link vivia no MESMO contêiner `overflow-x-auto` dos 4 links de
  navegação, só posicionado à direita — corrigido separando em contêineres
  irmãos, "+ Novo registro" sempre fora do rolável
- Guarda permanente (decisão do `cto-obra`): teste em 320px com badge
  inflado, provado não-vacuoso (falha contra o código antigo, passa
  depois) — trava a classe de regressão, não só o sintoma
- 274/274 E2E, sem regra fiscal tocada (layout puro)

### `55-2026-09-22-contai-041-entregue.md` — 40 linhas
**CONTAI-041 entregue — 2026-09-22 — tabela de despesas fecha a rodada "desktop shell"**

- `lib/fiscal/despesas.ts` (`linhasDeDespesa`) decompõe `alocacao` de volta
  em 1 linha por pagamento/documento — `ResumoObra.despesas` agrega por
  componente, não por pagamento, então precisava de projeção nova
- Garantia central provada, não só afirmada: 8 cenários de teste (1:1,
  N:1, 1:N, parcial, agregado) confirmam zero duplicação de centavo;
  `contador` conferiu a lógica com os próprios olhos, APPROVE de primeira
- Gate 2 do `cto-obra` achou bug real: documento sem valor virava "R$
  0,00" (afirmação de zero sem dado) — corrigido para "—"
- Chip neutro do terceiro estado fica fora do componente `Chip`; anotação
  "Nota sem arquivo" (CONTAI-033) entra mesmo fora da letra do critério
- 925 unitários + 273 E2E + validação manual extensa. Gate 4 (`po`) PASS.
  Sem migration. **Fecha a rodada inteira (042→040→043→044→045→046→041)**

### `54-2026-09-22-contai-046-entregue.md` — 35 linhas
**CONTAI-046 entregue — 2026-09-22 — obra e terreno migram para o shell (fecha 043-046)**

- `obras/[id]`, `terreno/*`, `discriminacao/[ano]`, `notas-sem-cno` migram
  para `(gestao)`, coluna 640px (discriminação sem exceção — `<pre>` não
  trunca). `podeGerarRelatorioAnual` continua porta única
- Achado que fecha uma dívida de 2 dias: o flaky de `discriminacao.spec.ts`
  (desde 2026-09-20, sempre descartado como "pré-existente") era bug de
  FUSO no teste (UTC vs. local), não regra fiscal — corrigido de vez,
  provado com `TZ=Pacific/Midway`
- **Suíte fecha 265/265 E2E, sem nenhuma falha conhecida**, pela primeira
  vez nesta sessão
- 890 unitários + validação manual extensa. Gate 4 (`po`) PASS. Sem
  migration. **Fecha os 4 tickets da migração (043-046)** — resta só o
  `CONTAI-041` (despesas) na rodada "desktop shell"

### `53-2026-09-21-contai-045-entregue.md` — 30 linhas
**CONTAI-045 entregue — 2026-09-21 — compromisso e pendência migram para o shell**

- `compromisso`/`[id]` (+ `cancelar`, `confirmar`, `data`) e
  `pendencias/[id]` migram para `(gestao)`, coluna 640px
- `contador` conferiu com os próprios olhos que a D65 (`cValor` sem
  default, CONTAI-034) sobrevive à migração — trava resolve por URL, não
  por pasta
- 3 decisões do `cto-obra` aceitas sem mudar código: banner âmbar sem
  obra (correção, não regressão), `/compromisso` mantém 640px (pilha de
  cards, não view de fila), duplicação `TresRespostas` pré-existente vira
  dívida nova
- 887 unitários + 256/257 E2E + validação manual. Gate 4 (`po`) PASS. Sem
  migration. Último ticket antes do `046`

### `52-2026-09-21-contai-044-entregue.md` — 30 linhas
**CONTAI-044 entregue — 2026-09-21 — pagamento e fatura migram para o shell**

- `pagamento/[id]` (+ `ligar`, `obra`) e `fatura/[id]` (+ `alocar`,
  `confirmar`, `parcial`) migram para `(gestao)`, mesma casca do `043`
- Telas de leitura perderam o rodapé fixo — ações foram para dentro do
  card, mesmo padrão de `/documento/[id]`
- `fatura/[id]/alocar`: resolvido sem exceção de largura — é lista
  label+checkbox, não tabela densa, cabe nos 640px padrão
- Implementado em Sonnet (Opus com 4 falhas de API seguidas nesta rodada);
  `cto-obra` confirmou que isso não muda o contrato de revisão
- 883 unitários + 252/253 E2E + validação manual. Gate 4 (`po`) PASS. Sem
  migration. Terceiro dos 4 tickets — próximo é o `045`

### `51-2026-09-21-contai-043-entregue.md` — 35 linhas
**CONTAI-043 entregue — 2026-09-21 — `/documento/[id]` migra para o shell**

- 10 rotas de `/documento/[id]` saem de `(captura)` e entram em `(gestao)`;
  `ColunaDeDetalhe` 640px, `RodapeDeAcao` sticky só em formulários,
  breadcrumb (`migalhaDaRota`) no lugar do botão fixo "Voltar"
- Nenhum texto fiscal mudou (confirmado pelo `contador` por diff filtrado
  + grep-travas repontados); `CabecalhoDaTela` evita o Pre-mortem 1 (obra
  do documento não vira "obra ativa" no topbar)
- Achado operacional do `cto-obra`: dois agentes rodando E2E ao mesmo tempo
  corrompem o Postgres local compartilhado — mesmo invariante de "um
  agente por vez", agora também para o banco
- 881 unitários + 249/250 E2E (1 falha pré-existente, `discriminacao.spec.
  ts:215`, do `046` futuro) + validação manual. Gate 4 (`po`) PASS. Sem
  migration. Primeiro dos 4 tickets `043`-`046` — próximo é o `044`

### `50-2026-09-21-migracao-detalhe-para-shell.md` — 40 linhas
**Migração de telas de detalhe para o shell — 2026-09-21 — `po` fatia em 4 tickets**

- Dívida nomeada pelo próprio `app/(captura)/layout.tsx` desde o `CONTAI-040`
  vira `CONTAI-043` (Documento), `044` (Pagamento+Fatura), `045`
  (Compromisso+Pendências), `046` (Obras+Terreno) — todos P1, ordem
  sugerida por uso diário decrescente, nenhum bloqueia o outro
- Achado do `cto-obra` (coluna ~560px, não full-width) formalizado como
  critério de aceite pela primeira vez
- `/entrar` e `/obras/nova` fora em definitivo; `/conta` fora desta rodada
- Gate 0 fechado no mesmo dia pelo `designer`: `design/mocks/detalhe-no-
  shell-v1.md`/`.html` (coluna final 640px, não 560px)

### `49-2026-09-21-contai-040-entregue.md` — 45 linhas
**CONTAI-040 entregue — 2026-09-21 — shell de navegação desktop + dashboard**

- Route groups Next 16: `(gestao)` com shell novo (sidebar+faixa mínima
  mobile, dashboard, `/despesas` stub, `/pendencias`, `/obras`) atrás de um
  `ProvedorDeGestao` único; `(captura)` intocado, ~40 telas movidas sem
  mudança de comportamento. Hacks do `039` (`Secao`/`Faixa`/`largo`/
  `alinharComFila`/`data-largo`) apagados
- Dashboard: 3 tiles de KPI reproduzindo verbatim as condicionais fiscais
  dos cards antigos (lidas das constantes vigentes, zero string hardcoded);
  badge da sidebar vem de `unificarPendencias().abertas`, fonte única
- Gate 2 (cto-obra+po+contador em paralelo) com 1 rework: `OPCOES_DE_
  REGISTRO` duplicada, extraída para `lib/gestao/navegacao.ts` com
  teste-trava verbatim contra `/adicionar/page.tsx`
- Decisões de produto do `po` no Gate 1 (`48-...md`): seletor de ano vira
  texto (ticket futuro P1); painel usa cards completos, não linha
  compacta (proibição de reescrever texto fiscal venceu o mock)
- 877 unitários + 248 E2E + validação manual extensa. Gate 4 (`po`) PASS,
  13/13 critérios. Sem migration. **Destrava o `CONTAI-041`**

### `48-2026-09-21-gate1-decisoes-contai-040.md` — 35 linhas
**Gate 1 do CONTAI-040, 4 decisões do `po` — 2026-09-21**

- Seletor de ano fica texto nesta rodada (controle funcional quebraria o
  requisito do Gate Fiscal do `042` de mesmo ano em dashboard e
  `/pendencias`) — ticket futuro não numerado, P1
- Painel de pendências usa cards completos de `ItemDaFila`, divergindo do
  mock (linha compacta) — 11 das 18 famílias só têm texto fiscal nos
  componentes existentes; mock corrigido para não ficar desatualizado
- `/despesas` stub + painel "Notas hábeis sem pagamento" confirmados, mas
  a proveniência da 2ª decisão (comentário de código, não registro
  formal) foi corrigida — mesmo modo de falha do `039`, em escala menor
- Texto "na fila de pendências" (era "nas seções abaixo") confirmado como
  copy de navegação, sem CRC do `contador`

### `45-2026-09-21-cenario-desktop-first-contai-039.md` — 62 linhas
**Cenário desktop-first — 2026-09-21 — "o uso atualmente é 100% desktop"**

- 2ª correção de "Cenários de uso" (a 1ª foi 2026-08-18): reação do Mateus ao
  `CONTAI-039` ter ficado "mobile esticado" em vez de desktop de verdade
- Decisão: 375px deixa de ser piso obrigatório; captura no canteiro deixa de
  ser a régua que trava decisão de desktop — registrada no `CLAUDE.md`
- Obsoleta a doutrina "375px é o piso, não o alvo" que rejeitou o Conceito 1
  (tabela) no Gate 1 do `CONTAI-039`; revisitar é trabalho do `designer`
- O que NÃO muda sem decisão futura: app não fica inacessível no celular,
  fluxo de captura não desaparece, disciplina fiscal intocada
- 3 perguntas abertas: até onde vai "pode quebrar", se vale só para gestão
  ou também para captura, e se é constatação do momento ou decisão permanente

### `47-2026-09-21-contai-042-entregue.md` — 40 linhas
**CONTAI-042 entregue — 2026-09-21 — `/pendencias` vira a fila única das 18 famílias**

- `lib/fiscal/pendencias-unificadas.ts` agrega as 18 famílias (7 de
  `pendencias[]` + 11 antes só agregadas na home) numa lista única por
  gravidade; `/pendencias` renderiza tudo, sem shell (isso é o `040`)
- Parecer do `contador`: 8 famílias de cor literal NÃO passam por
  `gravidadeDaRegua` (fabricaria fato fiscal); viraram constante nomeada
  lida também pela home
- Gate 2 com 1 rodada de REQUEST CHANGES (6 cards copiados, não extraídos —
  corrigido em `app/_components/pendencias-derivadas.tsx`, fonte única)
- 859 unitários + 247 E2E + validação manual. Gate 4 (`po`) PASS. Sem
  migration. **Destrava o `CONTAI-040`**

### `46-2026-09-21-cinco-decisoes-desktop-shell-contai-040-042.md` — 90 linhas
**Cinco decisões do desktop-shell-v1 — 2026-09-21 — `po` fecha as perguntas abertas e vira três tickets**

- Mock `design/mocks/desktop-shell-v1.md`/`.html` aprovado pelo Mateus,
  substitui o `CONTAI-039` rejeitado
- As 5 decisões: obra aberta só (sem consolidado), sem paginação nesta
  rodada, `/pendencias` absorve as derivadas (liga com D59/D54), arquitetura
  mobile×desktop delegada ao `cto-obra`, Despesas = todo Documento+Pagamento
  (comprovado ou não), terreno fora
- Tickets criados: `CONTAI-040` (shell+dashboard), `CONTAI-041` (Despesas),
  `CONTAI-042` (Pendências unificadas)
- **Adendo do mesmo dia**: `cto-obra` achou 18 famílias de pendência (não
  7) — inverte a ordem para `042` → `040` → `041` (evita o dashboard nascer
  escondendo 11 famílias, classe D46/D47); fecha a arquitetura mobile×
  desktop por route groups `(gestao)`/`(captura)`, não breakpoint; achou
  que `resumo.despesas` é por componente, não por pagamento
  (`linhasDeDespesa` nova no `041`)

| Achado técnico, sem ticket, 2026-09-29 | `docs/backlog/97-2026-09-29-parser-retencao-nao-reconhece-valor-bruto.md` — Mateus reportou NFS-e real (PerfuraTec nº 261) achando que o parser de retenção deveria ter pego o ISS impresso (R$1.797,03) e não pegou. Investigado antes de virar bug: `contador` confirmou que **não há retenção** nessa nota (`Valor bruto = Valor líquido`, situação "Normal" — o ISS é recolhido pela própria PerfuraTec, tomador PF não retém por regra, LC 116/2003 art. 6º §2º II). App está correto. Achado real e de baixa prioridade: `sugerirLinhaRetencao` (`lib/extracao/retencao-texto.ts`) só reconhece o rótulo "Valor Total" (`/total/i`), não "Valor bruto" — não fez diferença aqui (bruto=líquido zera a conta de qualquer forma), mas importaria numa nota futura com retenção real sob esse rótulo. P2, sem Gate Fiscal, sem urgência — fica registrado para quando/se aparecer nota real com esse padrão |

| Ticket criado, `CONTAI-081`, 2026-09-29 | `docs/backlog/96-2026-09-28-pre-vinculo-compromisso-nota-antes-do-pagamento.md` — continuação do `CONTAI-080` (entregue) pro fluxo de CARTÃO, que é a maioria do caso real (6 das 7 parcelas do concreto). `/tickets-req` completo: sem Gate Fiscal novo, mas 1 sanity check ao `contador` — confirmar N≥2 de vários compromissos numa tela só continua sendo confirmação explícita por conjunto, desde que cada bloco nasça neutro, grave individualmente e persista mesmo se o Mateus sair no meio. `cto-obra` achou e corrigiu, na própria rodada, o mesmo bug D1 do CONTAI-080 reaparecendo pela porta do cartão (a RPC de fatura propaga a origem incondicionalmente — corrigido com parâmetro `propagarOrigemIds`, migration `0024`). Rota nova `/fatura/[id]/vinculos` com blocos independentes de confirmação. `designer`: nível 1, `design/mocks/CONTAI-081.md`. Complexidade M (menor que o L do 080 — sem tabela nova). **Pronto para `/develop`.** Detalhe: `docs/tickets/CONTAI-081.md` |

| Ticket criado, `CONTAI-082`, 2026-09-30 | `docs/backlog/98-2026-09-30-filtro-busca-agenda-compromisso.md` — Mateus: *"deveríamos adicionar um filtro também nos /compromisso, e pesquisa por nome/favorecido"*. Motivado por caso real (fornecedor de concreto com 7 parcelas agendadas ao mesmo tempo). Mateus respondeu a pergunta aberta: escopo é só os subestados de urgência (vencido/vence hoje/vence amanhã/agendado), sem expandir pra mostrar quitados/cancelados. `/tickets-req` completo: sem Gate Fiscal, P1. `cto-obra` corrigiu 2 premissas do relato: `filtrarCandidatos` (CONTAI-078) não serve pra `Compromisso` (não tem `valorCentavos`, só `valorPrevistoCentavos` — protegido) e o filtro NÃO deve persistir (esconderia vencido sem o Mateus saber). Filtro reduz a entrada antes de `montarAgendaDaHome`, sem tocá-la. `designer`: nível 2, `design/mocks/CONTAI-082.md`. Complexidade S, sem migration. **Pronto para `/develop`.** Detalhe: `docs/tickets/CONTAI-082.md` |

| Ticket criado, `CONTAI-083`, P0, 2026-09-30 | `docs/backlog/99-2026-09-30-desvincular-origem-herdada-compromisso.md` — Mateus pediu "desvincular um agendamento de uma nota" (3 parcelas de R$15.000 presas à mesma origem herdada, NF 1531 R$30.340, favorecido Ilhamix Concreto); query read-only confirmou: é `compromisso.documento_origem_id` do `CONTAI-064`/`065` (imutável, sem tela que a desfaça), não o pré-vínculo editável do `CONTAI-080`/`081`. `/tickets-req` completo: `contador` fechou **ADENDO 9** em `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (§M.0-M.8) — desfazer é seguro (nada consumado), só limpar o campo (nunca auto-converter em pré-vínculo, recriaria o mesmo bug), 2 colunas de auditoria bastam (sem tabela de histórico), recusa total fora de "aberto". **P0 confirmado, mas o gatilho é a confirmação do 1º pagamento, não uma data** — memória de projeto criada pedindo ao Mateus segurar os 3 pagamentos da Ilhamix até este ticket entrar em produção. `cto-obra`: rota nova `/compromisso/[id]/origem`, migration `0025`, sem RPC (UPDATE condicional fecha a corrida). `designer`: nível 1, `design/mocks/CONTAI-083.md`. Complexidade S. **Pronto para `/develop`, com prioridade.** Detalhe: `docs/tickets/CONTAI-083.md` |

| Ticket criado, `CONTAI-084`, P1, 2026-09-30 | `docs/backlog/100-2026-09-30-criador-em-lote-de-parcelas.md` — Mateus: *"agora temos que fazer o parcelado verdadeiro... eu tenho que adicionar cada parcela. isso é inviável"*. Dor é fricção de digitação (criar N `Compromisso` um a um), não a recusa de parcelamento — **`RECUSA_PARCELADO`/ADENDO 5 não muda** (fundir parcelas num evento fiscal único segue fora de escopo). Respondidas as 3 perguntas: só cartão, sistema sugere valor e Mateus ajusta, cadência só mensal. `/tickets-req` completo: `contador` confirmou que nenhuma parcela do lote herda `documento_origem_id` (ADENDO 9) e que cada parcela é validada como "à vista" por construção, sem campo de parcelamento na tela (ratificação de linguagem: "o campo não se aplica a uma linha que já nasce à vista", não inferência por rota). `cto-obra` corrigiu 2 pontos do framing inicial — campo `parc` não existe no schema (tradução ratificada) e faltava a data-semente do gerador (2 campos: data da compra + vencimento da 1ª fatura) — e decidiu RPC transacional nova (`compra_cartao_gravar_lote`, migration `0026`) em vez de N chamadas client-side, pra tudo-ou-nada ser de verdade. `designer`: nível 1, `design/mocks/CONTAI-084.md`, rota nova `/adicionar/compra-cartao/parcelas`. Complexidade M. **Pronto para `/develop`.** Detalhe: `docs/tickets/CONTAI-084.md` |

## Ao acrescentar ao backlog

Nova entrada = **arquivo novo** em `docs/backlog/`, nomeado
`NN-AAAA-MM-DD-assunto.md`, mais uma linha neste índice. Não volte a engordar
um arquivo único: foi exatamente assim que ele chegou a 150 KB.
