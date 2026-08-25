# CONTAI-032 — spec do mock
Nível: 1 (HTML navegável)   Cenário: captura (registrar o que acabou de acontecer)   Arquivo: CONTAI-032.html
Tela existente: `app/adicionar/pagamento/page.tsx` — só o bloco Meio/Data/Valor/Comprovante/Gravar muda.
375px (piso = alvo aqui, é tela de captura). 1 tela, 1 fluxo interativo com 5 estados internos.

## Por que nível 1, e não 2
Tirar o default não é só "campo nasce vazio": nasce um ESTADO de tela que hoje não existe —
`indefinido`, antes de `decidirRegistro` rodar (achado do `cto-obra`). Esse estado muda SIMULTANEAMENTE
4 coisas: os rótulos de Data/Valor (perdem o qualificador "do pagamento"/"previsto"), a mensagem do
Comprovante, a presença dos banners de consequência, e o texto+estado do botão. É densidade e
hierarquia — "o que aparece junto, o que evapora, em que ordem" — exatamente o que a regra do
`CLAUDE.md` manda decidir vendo, mesmo a tela sendo antiga.

## Telas e estados
Uma tela, função `estado(meio, data, hoje)` gate ANTES de `decidirRegistro` (mock: `cartao` decide
sozinho, sem olhar a data — é o achado "RECUSA_CARTAO alcançável de verdade" do `po`):
- **`indefinido`** (estado inicial: nada digitado) — rótulos neutros ("Data *", "Valor *"), nenhum
  banner de consequência, Gravar desabilitado com o motivo no próprio rótulo
- **`indefinido` parcial** (só Meio OU só Data preenchidos) — mesmo layout neutro; o rótulo do Gravar
  fica mais específico ("Informe a data para continuar" / "Escolha como foi pago para continuar")
- **`recusado`** (Meio = cartão, com ou sem Data) — banner vermelho + Gravar desabilitado com
  "Cartão ainda não tem fluxo neste app" (texto e trava já existem no código real)
- **`pagamento`** (Meio ≠ cartão, Data ≤ hoje) — layout de hoje, sem mudança
- **`compromisso`** (Meio ≠ cartão, Data > hoje) — layout de hoje, sem mudança
Sem loading, sem vazio (não há lista), sem erro de rede — é formulário puro.

## Campos
- `meio` — Escolha 1-de-3 (PIX/Boleto/Cartão) — **nasce sem nenhum marcado** — SEM DEFAULT
- `fData` — `type=date` — **nasce vazio** — SEM DEFAULT — decide o branch junto com `meio`
- `fValor` — inalterado por este ticket (rótulo só troca o qualificador; validação já existia)
- `comprovante` — inalterado por este ticket (nunca bloqueia; mock inclui para mostrar que os
  banners de "sem comprovante" continuam corretos nos estados resolvidos)

## Textos com consequência fiscal
- "Informe a data em que o pagamento saiu." — `lib/fiscal/pagamento.ts:150-154`, já existe
- "Informe como foi pago — PIX, boleto ou cartão." — texto novo, do `contador` (via `po`), ainda sem
  arquivo — precisa virar constante em `lib/fiscal/pagamento.ts` ou `compromisso.ts` no Gate 2
- `RECUSA_CARTAO` + `RECUSA_CARTAO_ONDE_REGISTRAR` — `lib/fiscal/compromisso.ts:93-105`, literais,
  inalterados — só ficam **alcançáveis sem Data preenchida**, que é a mudança
- "A data que vale para o custo é a do pagamento, não a da nota…" (`DATA_QUE_VALE_PARA_O_CUSTO`,
  `lib/fiscal/pagamento.ts:331-333`) e o banner "Vai nascer como aguardando NF…" (`page.tsx:896-901`) —
  inalterados, só voltaram a aparecer no mock para mostrar que os estados resolvidos não regrediram
- "Vai salvar assim mesmo. Fica como pago sem comprovante…" (`rotulosPagoSemComprovante`,
  `lib/fiscal/pagamento.ts:190-263`) — inalterado

## Navegação
Não há navegação entre telas — é o mesmo formulário mudando de estado com o toque em Meio e a
digitação da Data. `estado()` roda a cada interação; nenhum toque em Meio/Data é "confirmar", é só
digitar — o app decide, o usuário nunca escolhe "já paguei/vou pagar" (regra que este ticket não toca).

## Decisões de design
1. **O botão fica desabilitado, com o motivo no próprio rótulo** (padrão que já existe no código real
   para `cartaoRecusado`, `page.tsx:934`) — não "clique e descubra por validação". Bloqueado de verdade
   bate com a frase do `po` ("nenhuma linha grava") melhor do que validação-no-clique.
2. **A mensagem de campo vazio ("Informe...") fica visível o tempo todo enquanto o campo está vazio**,
   não só depois de uma tentativa de gravar — porque o botão desabilitado nunca dispara essa tentativa.
   Isolada por campo (isolados ou juntos, como pediu o `po`): some assim que aquele campo específico é
   preenchido, mesmo que o outro continue faltando.
3. **Por que este ticket BLOQUEIA e o CONTAI-025 (desembolso do terreno) NUNCA bloqueia por campo
   vazio** — parecem contraditórios e não são: no CONTAI-025 a Data que falta é "quando", o fato "saiu
   da conta" já foi afirmado por outro campo (`fEstado`), então gravar com pendência é seguro. Aqui,
   Meio+Data são o que decide **qual fato é este** (pagamento executado × compromisso × cartão sem
   fluxo) — gravar sem eles forçaria o app a chutar o tipo, que é o próprio bug que o `cto-obra` achou
   (`"" <= hoje` cai em `pagamento` por acidente). Bloquear aqui não é a mesma régua relaxada em outro
   lugar — é o mesmo princípio (não inventar fato) aplicado a um campo que classifica, não a um campo
   que data.
4. **`fValor` e `comprovante` não mudam de comportamento**, só o texto ao redor deles muda com o
   estado — nenhum dos dois ganhou validação nova neste ticket.

## Perguntas em aberto
1. **Não é pergunta, é constatação para o Gate 2**: o texto novo de Meio ("Informe como foi pago —
   PIX, boleto ou cartão.") ainda não tem lar em `lib/fiscal/*.ts` — o `lead-engineer` precisa criar a
   constante, não redigir de novo.
2. O rótulo do Gravar quando só falta a Data ("Informe a data para continuar") e quando só falta o
   Meio ("Escolha como foi pago para continuar") são texto do designer, não do `contador` — se ele
   quiser outra palavra, é ajuste de Gate 2, sem mudar o mock.
3. Ordem dos botões PIX/Boleto/Cartão continua a mesma de hoje (PIX primeiro) — é a única mitigação de
   atrito de captura que este mock assume; um atalho de toque tipo "Hoje" na Data foi cogitado e
   **descartado por mim**: seria uma conveniência não pedida pelo `po`, e eu não decido isso sozinho.
