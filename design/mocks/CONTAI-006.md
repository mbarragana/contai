# CONTAI-006 — Textos de espera, erro e gravação incerta

**Gate 0 do próprio ticket: NÃO exige mock.** Não há tela, campo nem fluxo
novo — são **estados novos de telas que já existem** (o "Carregando…" e o
"Tentar de novo" já estão em produção). Sob a política vigente desde
2026-09-20 (sem HTML, sem gate de aprovação), esta é a entrega completa:
**nível 3 — tabela de textos**, com o mínimo de estrutura (duas pequenas
máquinas de estado em ASCII) só onde a ORDEM de troca de texto é o ponto —
critério 2 é literalmente sobre sequência, não sobre leiaute.

Cenário: **misto por natureza do estado, não por tela** — a mesma tela de
gestão (home, em casa) e a mesma tela de captura (`/adicionar/documento`, no
canteiro) passam pelos dois modelos abaixo. Não há tela que seja só-leitura
ou só-gravação neste ticket: leitura acontece em toda tela que abre, gravação
em toda tela com "Salvar".

Fontes: `docs/tickets/CONTAI-006.md` (corpo inteiro — critérios 1, 2, 3, 6, 7
citados literalmente onde marcado); código lido para ancorar o que já existe:
`app/_components/ui.tsx:254-313` (`Carregando`, `EstadoErro`),
`lib/dados/erros.ts` (`mensagemDeErro`, `classificarErro`, `ErroDeTela`),
`app/_components/usar-obra-do-registro.ts` (padrão de fase
`carregando`/`erro`/`pronta` reaproveitado em várias telas),
`app/adicionar/documento/page.tsx:462-602` (fluxo de gravação concreto, usado
como exemplo). Gate Fiscal do ticket: **sem impacto** — nenhum texto abaixo
carrega consequência fiscal, então nada aqui precisa passar pelo `contador`.

---

## Duas máquinas de estado (a ordem é o critério 2)

### Leitura (toda tela que hoje usa `Carregando`/`EstadoErro`)

```
abre a tela
    │
    ▼
"Carregando {o quê}"  ← texto específico de cada tela, JÁ EXISTE, sem mudança
    │
    │  passam ~2s sem resposta  OU  a 1ª tentativa já falhou — o que vier
    │  primeiro (critério 2: nunca esperar o relógio se já se sabe que falhou)
    ▼
"Sem resposta do servidor — tentando de novo."
    │
    │  mais um ciclo de tentativa sem sucesso (ainda dentro do teto)
    ▼
"Ainda tentando. Se o servidor estava inativo por um tempo, isso pode
 levar mais alguns segundos que o normal."           (cobre critério 7)
    │
    │  teto de espera atingido, sem mais tentativa automática
    ▼
ERRO FINAL — banner vermelho + "Tentar de novo"
"Não foi possível falar com o servidor depois de várias tentativas.
 Verifique sua conexão e tente de novo."
```

Ramo lateral, sem passar pelos textos acima: se o servidor **já respondeu**
com um erro definitivo (sem sessão, erro de negócio com mensagem própria como
"CNPJ/CPF inválido."), a tela mostra esse texto específico na hora — ele não
é silêncio, é uma resposta, então não faz sentido fingir que ainda está
tentando. Isso já é o comportamento de `EstadoErro`/`classificarErro` hoje;
não muda.

### Gravação (toda tela com um "Salvar" — formulários de registro, correção,
linha de retenção, agendar/confirmar compromisso etc.)

```
toca "Salvar"
    │
    ▼
botão desabilitado, rótulo "Salvando…"      ← JÁ EXISTE (ex.: documento,
    │                                          pagamento), sem mudança
    │  passam ~2s sem resposta
    ▼
botão continua desabilitado, rótulo "Ainda salvando…"
+ texto auxiliar abaixo do botão: "Não feche nem recarregue a página."
    │
    ├─ resposta chegou, servidor CONFIRMOU  ─────► segue fluxo de sucesso já
    │                                               existente (ex.: tela
    │                                               "Registrado")
    │
    ├─ resposta chegou, servidor RECUSOU (erro    ► "Não foi salvo. {motivo
    │  com corpo/mensagem — nada foi committed)      específico}" — reaproveita
    │                                                 o texto que já existe
    │                                                 quando ele é específico
    │                                                 (ex.: validação)
    │
    └─ NENHUMA resposta chegou (conexão caiu,     ► RESULTADO INCERTO — ver
       timeout, aba fechou e reabriu no meio)        texto abaixo. NUNCA usa
                                                      o fallback genérico
                                                      atual, que soa seguro
                                                      demais para repetir.
```

Este ticket **não adiciona retry automático de gravação** (Out of Scope do
próprio ticket) — a tela só passa a admitir, honestamente, que não sabe o
resultado quando de fato não sabe.

---

## Campos
- SEM CAMPOS — este spec é de ESTADO de rede (lento, indisponível, retomada),
  não de formulário: nenhum controle novo nasce em tela nenhuma.

## Textos exatos

### Leitura

| Estado | Texto | Onde/como aparece |
|---|---|---|
| Carregando (0–~2s) | *(sem mudança)* — texto específico já usado por tela: "Carregando a obra", "Carregando os documentos" etc. | Componente `Carregando` (`app/_components/ui.tsx:255`), skeleton de barras, `role="status"` |
| Sem resposta, tentando de novo | **"Sem resposta do servidor — tentando de novo."** — citação literal do critério 1 | Mesmo container do estado acima, mas o **skeleton some** e vira esta linha de texto simples, tom secundário (mesmo peso visual de `Dica`/texto auxiliar — não é banner de erro). Continua `role="status"`, então leitor de tela anuncia a troca sozinho |
| Ainda tentando (tier 2, cobre projeto pausado) | **"Ainda tentando. Se o servidor estava inativo por um tempo, isso pode levar mais alguns segundos que o normal."** | Mesmo tratamento visual do estado anterior — só troca o texto, não vira erro. É a resposta ao critério 7: não inventa certeza ("está acordando"), mas dá uma explicação plausível em vez de deixar o silêncio se repetir sem contexto |
| Erro final (teto atingido) | **"Não foi possível falar com o servidor depois de várias tentativas. Verifique sua conexão e tente de novo."** | `Banner cor="red"` dentro de `EstadoErro` (`app/_components/ui.tsx:301-313`), com o botão **"Tentar de novo"** já existente — sem mudança de componente, só de gatilho (hoje sem teto; critério 3 exige que este estado exista) |
| Erro específico do servidor (sem sessão, validação de negócio) | *(sem mudança)* — mensagem própria já existente, ex. "Sua sessão terminou. Entre de novo para ver a obra." (`SemSessaoError`), ou a mensagem literal que `mensagemDeErro` extrai do erro | Mesmo `EstadoErro`, ramo já implementado — citado aqui só para deixar explícito que ele **não** passa pelos textos genéricos acima |

### Gravação

| Estado | Texto | Onde/como aparece |
|---|---|---|
| Salvando (0–~2s) | *(sem mudança)* — rótulo específico já usado, ex. "Salvando…" | Botão desabilitado, padrão já existente (`app/adicionar/documento/page.tsx:1169-1176`) |
| Ainda salvando (a partir de ~2s sem resposta) | Rótulo do botão: **"Ainda salvando…"** (curto, cabe no botão em 375px) + texto auxiliar abaixo, tom secundário: **"Não feche nem recarregue a página."** | Botão continua desabilitado; texto auxiliar no mesmo padrão de `Dica`, some assim que a resposta chegar (sucesso ou falha) |
| Falha certa (servidor respondeu recusando) | *(sem mudança quando a mensagem já é específica)* — reaproveita `mensagemDeErro`, ex. "CNPJ/CPF inválido.", "Não foi possível identificar o favorecido." | `Banner cor="red"`, formulário preservado — comportamento já existente |
| Resultado incerto (nenhuma resposta chegou) | **"Não deu para confirmar se isso foi salvo. Antes de tentar de novo, confira {onde} — repetir sem conferir pode duplicar o registro."** — o `{onde}` é preenchido por tela (ver tabela de variantes abaixo) | `Banner cor="red"` (mesmo componente visual de erro — é um problema real, não um aviso neutro), botão **"Tentar de novo"** só aparece **depois** desse texto, nunca antes/sem ele |

Variantes do `{onde}`, por tela de gravação (preencher conforme a ação —
lista não exaustiva, é o padrão que o `lead-engineer` replica em qualquer
"Salvar" que hoje só trata a falha como "nada foi salvo"):

| Tela / ação | `{onde}` |
|---|---|
| `/adicionar/documento` — criar documento | "na lista de documentos desta obra" |
| `/adicionar/pagamento` — criar pagamento | "na lista de pagamentos desta obra" |
| `/documento/[id]` — adicionar linha de retenção (CONTAI-038) | "na lista de linhas de retenção desta nota" |
| `/compromisso/*` — agendar/confirmar/cancelar compromisso | "na lista de compromissos" |
| Correções (`/documento/[id]/corrigir/...`) | "no valor/campo que você acabou de corrigir" |

---

## Achado — o texto genérico atual soa mais seguro do que é

`mensagemDeErro` (`lib/dados/erros.ts:21-28`) tem um fallback único para
**qualquer** erro sem `message` reconhecível:

> "Não foi possível falar com o servidor. Tente de novo."

Hoje esse mesmo texto sai tanto para uma LEITURA que falhou (tentar de novo é
sempre seguro — GET não duplica nada) quanto para uma GRAVAÇÃO que falhou sem
resposta nenhuma (tentar de novo pode duplicar — é a dor de origem do
ticket). O texto convida a repetir sem dizer que, no caso de gravação, ele
não sabe se já salvou. Isso **é** a mentira que o critério 6 pede para
eliminar, só que num lugar mais discreto que o "Carregando" do achado
original.

Proposta: este fallback continua servindo LEITURA sem mudança. Para
GRAVAÇÃO, a chamada precisa **classificar** o erro em duas categorias antes
de escolher o texto:

1. **Houve resposta do servidor recusando** (há corpo/código de erro
   reconhecível — validação, RLS, constraint) → é seguro afirmar "não foi
   salvo", com a mensagem específica quando existir.
2. **Não houve resposta nenhuma** (erro de rede antes de qualquer resposta,
   timeout, `AbortError`) → é o caso "Resultado incerto" da tabela acima —
   nunca usa o fallback genérico atual, que hoje cai sem distinção nos dois
   casos.

⚠️ **Como o código distingue 1 de 2 na prática** (qual sinal do
postgrest-js/fetch confirma "houve resposta") é decisão técnica do
`cto-obra` — o mesmo espírito do critério 4, que já reserva ao `cto-obra` a
definição de comportamento de retry. O que este spec fixa é o **texto de
cada categoria** e a **regra de quando usar qual** — não o mecanismo de
detecção.

---

## Decisões de design

1. **O skeleton não fica embaixo do texto de espera.** Ao trocar para "Sem
   resposta do servidor — tentando de novo.", o skeleton desaparece por
   completo — manter as barras cinzas ao lado do aviso sugeriria "quase
   pronto", que é exatamente a mentira que o critério 2 ataca.
2. **Teto de espera não tem contagem regressiva visível.** O ticket pede um
   erro acionável quando o teto estoura, não um cronômetro — mostrar
   "00:07 restantes" adiciona precisão falsa sobre um número que hoje nem
   está fechado (Pergunta Aberta 3 do próprio ticket, ainda sem resposta do
   Mateus).
3. **"Ainda tentando" (tier do critério 7) é opcional por tela, não por
   tipo de dado.** Ele só faz sentido em telas cuja janela de espera é longa
   o bastante para ter um segundo ciclo antes do teto — mesma lista de telas
   do critério 3 (auditoria de leitura), sem exceção por tipo de tela de
   gestão vs. captura: a régua de cenário deste ticket não é sobre
   densidade, é sobre a mesma verdade em qualquer tela.
4. **Gravação nunca ganha retry automático nem um segundo botão.** Continua
   um único "Tentar de novo" — a diferença toda está no texto que vem antes
   dele avisar do risco de duplicar, não em fricção extra de UI (botão
   "Já conferi, tentar de novo" foi cogitado e descartado — texto claro já
   resolve, e um botão a mais é fricção sem ganho no critério 6).
5. **"Ainda salvando…" cabe no botão; o aviso de não fechar a página, não.**
   Por isso o aviso vira uma linha auxiliar abaixo do botão (mesmo padrão do
   texto complementar já usado no CONTAI-021), em vez de inchar o rótulo do
   botão até quebrar em 375px.

---

## Perguntas abertas

1. **Perguntas 1, 2 e 3 do próprio ticket (se já aconteceu em produção, se
   ele já recarregou no meio de um "Salvando", e qual teto é tolerável)**
   continuam sem resposta do Mateus — não são perguntas de texto, são de
   produto/prioridade, e o `po` é quem deve fechá-las antes do Gate 1 (o
   número exato do teto muda o critério 5, não os textos deste spec).
2. **Mecanismo de detecção "houve resposta vs. não houve resposta"** (Achado
   acima) — decisão do `cto-obra`, a levantar no Gate 1/Gate 2. Os textos
   deste spec não mudam conforme a resposta técnica; só a regra de qual
   texto usar quando depende dela.
3. **Lista completa de telas de gravação a receber o tratamento "Ainda
   salvando…"/"Resultado incerto"** — a Viabilidade do ticket não lista os
   arquivos de escrita (só os de leitura). Este spec dá o padrão e três
   exemplos concretos (documento, pagamento, linha de retenção); cabe ao
   `lead-engineer`, no Gate 1, mapear os demais "Salvar" do app contra este
   mesmo padrão — sinalizar ao `cto-obra` se achar um ponto de gravação que
   não se encaixa limpo nele (ex.: uma tela que já tem retry próprio).
