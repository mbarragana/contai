# CONTAI-092 — card "Integrações" em `/conta` + evento de lembrete no Google Calendar

Cenário: **gestão** (em casa, sentado, com calma). `/conta` é tela de
configuração de conta — não existe versão "no canteiro" dela, e nenhum dos 4
estados do card pede resposta rápida de uma mão. O botão "Conectar" dispara um
redirecionamento OAuth que só faz sentido como ato deliberado, sentado, não
como gesto de 3 segundos no meio de uma obra. **Teste do Canteiro não se
aplica aqui.**

## Nota sobre nível

A pergunta que me chegou propunha "nível 1 HTML / 2 spec+ASCII / 3 tabela" —
essa régua de 3 níveis é a de **antes de 2026-09-20**. Desde a mudança, a
saída é **sempre** este `.md` (nunca HTML); o que varia é só a profundidade.
Esta entrega está na profundidade **de tela nova completa** (não é delta):
card novo, 4 estados, e é o primeiro fluxo do app com redirecionamento OAuth
externo visível ao usuário — não há spec vizinho para herdar comportamento, e
"não vou adivinhar densidade" vale tanto aqui quanto numa tela do zero.

## Fluxo (antes da tela)

1. Mateus abre `/conta` → vê o card "Integrações" num dos 4 estados abaixo.
2. **Não configurado** → nada a fazer, card só informa.
3. **Não conectado** → clica "Conectar Google Agenda" → sai do app, tela de
   consentimento do Google → volta para `/conta`.
   - Concedeu: estado muda para **Conectado**.
   - Cancelou/negou no Google: volta para **Não conectado** + um aviso
     temporário de que a conexão não foi concluída (não é um 5º estado
     persistente — é o estado 2 com uma `Dica` extra por 1 carregamento).
4. **Conectado** → card mostra conta, data, pendentes. Botão "Sincronizar
   agora" dispara sincronização manual dos compromissos com falha acumulada;
   enquanto roda, botão mostra "Sincronizando…" e fica desabilitado.
5. Se o Google revogar/expirar o token (fora do app, ex. Mateus revogou nas
   configurações da própria conta Google) → próxima tentativa de escrita
   falha → card muda para **Expirado/revogado** na carga seguinte de `/conta`.
6. Falha de sincronização de **um compromisso específico** (API deu erro,
   mas o token ainda é válido) não muda o estado do card — aparece como linha
   isolada no detalhe daquele compromisso (seção própria abaixo). O card de
   `/conta` só reflete o estado da **conexão**, nunca o de um evento
   individual.

## Telas e estados

### `/conta` — card "Integrações" (novo)

Posição: **depois** do card de dados da conta (E-mail/Obras/Sessão) existente
e da `Dica` de sessão, **antes** do card vermelho "Sair" — fica entre
"informação neutra" e "ação destrutiva", nunca ao lado da segunda.

Título do card (via `<Passo>`, mesmo padrão dos outros cards com título):
`Integrações`

#### Estado 1 — Não configurado
Guarda: variável de ambiente do Google (client id/secret) ausente no
servidor. Único estado sem chamada de API — é checado no carregamento inicial
da tela, junto com o resto do `fase: "pronto"`.

```
┌ Integrações ───────────────────────────────┐
│ Google Agenda                              │
│                                             │
│ Lembrete automático de pagamento ainda não │
│ está disponível nesta instalação.          │
└─────────────────────────────────────────────┘
```
- Sem botão, sem chip. Texto único, via `<Dica>`. Não é erro (não tem retry):
  é ausência de configuração, estado estável.
- `data-integracao-google="nao-configurado"` no card, para o E2E poder
  distinguir dos outros 3 sem depender de texto.

#### Estado 2 — Não conectado
Guarda: variável de ambiente presente, mas Mateus nunca concluiu o OAuth (ou
nunca houve `concedido_em` gravado).

```
┌ Integrações ───────────────────────────────┐
│ Google Agenda                              │
│                                             │
│ Lembretes automáticos (5, 2 e 0 dias antes)│
│ de cada pagamento PIX/boleto agendado, na  │
│ sua própria Google Agenda. É conveniência  │
│ — não substitui conferir o app.            │
│                                             │
│ [ Conectar Google Agenda ]  (primary)      │
└─────────────────────────────────────────────┘
```
- Texto de 1 frase cobre a restrição do Gate Fiscal já na primeira vez que o
  Mateus vê o recurso ("é conveniência — não substitui conferir o app"), não
  só no texto do evento.
- Clique → redireciona para a tela de consentimento do Google (fora do app).
  Enquanto o redirecionamento não resolve, botão mostra "Conectando…"
  desabilitado (é navegação de página inteira, então esse estado dura pouco,
  mas evita duplo clique).
- Se voltou de uma tentativa cancelada/negada no Google: mesmo estado 2, com
  uma `<Dica>` extra em vermelho leve acima do botão: *"A conexão não foi
  concluída. Você pode tentar de novo quando quiser — nada foi alterado."*
  Detectado por um parâmetro de query transitório na volta (`?google=negado`
  ou equivalente — nome exato é do `cto-obra`/`lead-engineer`), consumido e
  descartado no primeiro render (não persiste em refresh).

#### Estado 3 — Conectado
Guarda: existe `concedido_em` e o token é considerado válido (não expirado,
sem erro de autorização na última tentativa de uso).

```
┌ Integrações ───────────────────────────────┐
│ Google Agenda                              │
│                                             │
│ Conta Google      fulano@gmail.com         │
│ Conectado desde   12/09/2026               │
│ Pendentes         0   (ou: 3 compromissos) │
│                                             │
│ [ Sincronizar agora ]  (ghost)             │
└─────────────────────────────────────────────┘
```
- `Linha rotulo="Conta Google"` → e-mail da conta Google autorizada (não é
  necessariamente o mesmo e-mail de login do contai — são contas diferentes
  por natureza, e a tela não deve sugerir que são a mesma coisa).
- `Linha rotulo="Conectado desde"` → `formatarDataBR(concedido_em)`.
- `Linha rotulo="Pendentes"` → contagem de compromissos com sincronização
  pendente/com falha. `0` é o estado saudável — mostrar o número sempre,
  mesmo zero (não esconder a linha em 0: é a confirmação de que está tudo
  sincronizado, não um buraco na tela).
- Botão "Sincronizar agora": `ghost`, não `primary` — é reforço manual de algo
  que já roda automaticamente, não a ação principal da tela. Desabilitado +
  texto "Sincronizando…" durante a chamada. Ao terminar, atualiza a contagem
  de pendentes in-place (sem reload de página) e, se zerou, nenhuma celebração
  — só o número vira 0.
- **Sem botão de desconectar nesta entrega.** Decisão deliberada, não
  esquecimento: o ticket/relato não pede revogação pelo app, e inventar um
  fluxo de "desconectar" (o que fazer com eventos já criados? apagar todos?)
  é requisito novo, não uma consequência óbvia deste. **Pergunta aberta para
  o `po`**: vale um botão "Desconectar" num ticket futuro, ou revogar pela
  própria conta Google (Google Account → Segurança → Apps conectados) é
  suficiente para um app de uma pessoa só? Até resposta, revogar fica fora do
  app — e o caminho natural para isso já existe (fora do app) é o motivo de eu
  não bloquear esta entrega nessa pergunta.

#### Estado 4 — Autorização expirada/revogada
Guarda: existe `concedido_em`, mas a última tentativa de uso do token voltou
com erro de autorização (401/invalid_grant do Google).

```
┌ Integrações ───────────────────────────────┐
│ Google Agenda                              │
│                                             │
│ ⚠ A sincronização com o Google Agenda está │
│   interrompida. Os lembretes não estão     │
│   sendo criados nem atualizados até você   │
│   conectar de novo.                        │
│                                             │
│ Última conta conectada   fulano@gmail.com  │
│                                             │
│ [ Conectar de novo ]  (primary)            │
└─────────────────────────────────────────────┘
```
- `<Banner cor="amb" role="status">` para o aviso (mesmo componente e peso
  visual já usado no detalhe do agendamento para "Quitado"/"Não vai ser
  pago" — amb é alerta operacional, não fiscal, aqui também).
  **Não é `cor="red"`**: nenhum dinheiro saiu errado, nenhum documento está
  faltando — é uma conveniência pausada, a cor vermelha do app é reservada
  para custo fora do lugar e documentação faltante.
- `Linha rotulo="Última conta conectada"` → mantém o e-mail anterior visível
  (ajuda o Mateus a saber se é a conta certa ao reconectar).
- Botão "Conectar de novo": `primary` (aqui sim — ação clara, única, que
  resolve o estado). Mesmo redirecionamento OAuth do estado 2.

### Detalhe do compromisso — linha de sincronização do lembrete
Arquivo: `app/(gestao)/compromisso/[id]/page.tsx`, dentro do Card de fatos já
existente (o que tem `Linha rotulo="Situação"` / "Como vai ser pago" / "Data
prevista" / "Ainda falta pagar"). Entra **depois** de "Ainda falta pagar" e da
`Linha` condicional "Nota de origem", **antes** do bloco do chip de
pré-vínculo e do bloco de Ações — é mais um fato sobre o compromisso, no
mesmo nível dos outros.

Guarda de exibição: `aberto` (situação = 'aberto') **e** a integração está
conectada (estado 3 ou 4 do card de `/conta` — se nunca foi conectada, não
existe tentativa de sincronização, então não há o que relatar aqui) **e**
este compromisso específico tem falha de sincronização registrada. (Nome
exato do campo/flag que carrega essa informação até esta tela é do
`cto-obra` no Gate 2 — aqui só descrevo a condição lógica e o texto.)

```
⚠ Lembrete no Google Agenda: não sincronizado. [tentar de novo]
```
- Texto-base do `cto-obra`, mantido quase literal — só acrescentei o ponto
  final e separei a ação. Não é erro fiscal (não usa `Banner`/`Consequencia`
  vermelhos): é uma linha curta, ícone de alerta leve + texto + ação inline,
  cor âmbar (mesmo raciocínio do estado 4 do card: conveniência pausada, não
  dinheiro ou documento fora do lugar).
- `[tentar de novo]` é um botão de texto (estilo link, não `Botao` cheio) que
  dispara nova tentativa de sincronização **só deste compromisso** — não leva
  para `/conta`. Ao clicar: texto muda para "sincronizando…"; se der certo, a
  linha inteira desaparece (o fato deixou de ser verdadeiro); se falhar de
  novo, volta ao texto original (sem contador de tentativas visível).
- Se a causa raiz for autorização expirada (estado 4 do card), essa linha
  ainda aparece igual — ela não tenta diagnosticar "por quê", só relata "não
  sincronizado". Quem explica a causa é o card de `/conta`; esta linha só
  aponta que *este* compromisso está com lembrete pendente e oferece a ação
  mais barata (tentar de novo). Repetir aqui "sua conexão expirou" duplicaria
  o card e ainda erraria quando a causa for só uma falha pontual da API.

### Evento do Google Calendar — título e descrição
**Pergunta de produto que eu decido aqui (não é fiscal, é UX; registrado como
decisão, revogável)**: incluir favorecido e valor no evento, **sim**. O
evento vive na agenda pessoal do Mateus, não é compartilhado nem exportado —
o ganho de reconhecer de cabeça qual pagamento é qual (quando há mais de um
compromisso em aberto na mesma semana) supera o risco de exposição, que
nesse calendário é o mesmo risco que já existe para qualquer outro
compromisso financeiro que ele já anota lá.

**Título**: `Pagamento {favorecido} — R$ {valor}`
Exemplo: `Pagamento Empreiteira XYZ — R$ 3.200,00`
- Se `favorecidoNome` for nulo (compromisso sem favorecido informado — existe
  no modelo, visto em outras telas): `Pagamento agendado — R$ {valor}`.

**Descrição/popup do evento**:
```
Lembrete de pagamento agendado no contai — conveniência, não é controle
fiscal nem garantia de que o pagamento vai sair em dia.

Favorecido: {favorecido ou "não informado"}
Valor previsto: R$ {valor}
Forma: {Pix | Boleto}
Vencimento previsto: {data}
```
- A frase de abertura é o texto que carrega a restrição do Gate Fiscal
  (passo 2 do `/tickets-req`, em paralelo) — redigida por mim nesta sessão
  porque **não existe parecer do `contador` ainda para copiar** (diferente da
  regra geral do CLAUDE.md de nunca redigir texto fiscal de memória: aqui não
  há regra fiscal nenhuma sendo citada, é só a restrição de tom que o
  `cto-obra` repassou). **Antes deste ticket ir a `/develop`, confirmar com o
  `contador`** se esta frase satisfaz a restrição dele ou se ele prefere outra
  redação — não travar, mas não tratar como fechado.
- Sem link de volta para o app no corpo do evento nesta entrega (seria bom,
  mas depende de o contai ter URL pública estável e não foi pedido no
  escopo) — fica como ideia registrada, não como requisito.
- `reminders.overrides`: 3 entradas (5 dias, 2 dias, 0 dias antes), conforme
  já fechado no relato/critérios de aceite — não é texto, é configuração do
  evento; não aparece escrito em lugar nenhum da UI do Google, o próprio
  Calendar dispara as notificações nos offsets configurados.

## Campos
Nenhum campo novo de formulário — esta entrega não tem tela de captura nem
edição de dado fiscal. O botão "Conectar" não é um campo, é uma ação que
inicia um redirecionamento; nada aqui é digitado pelo Mateus. A disciplina de
"campo vazio pergunta, campo preenchido afirma, sem default em campo fiscal"
**não se aplica por ausência de campo**, não por exceção — confirmando
explicitamente, como pedido.

## Textos com consequência fiscal
Nenhum — este fluxo não tem consequência fiscal (é lembrete de conveniência,
não documentação hábil nem apuração). O texto que existe é restrição de
**tom** (não prometer garantia, não soar como controle oficial), pedida pelo
`cto-obra` em nome do Gate Fiscal do `contador`, ainda sem parecer escrito.
Toda a microcópia deste spec (botões, estados do card, linha do compromisso,
título/descrição do evento) foi escrita observando essa restrição, mas é
**provisória até o parecer do passo 2 confirmar** — se ele vier com texto
diferente, este spec é quem atualiza, não o código direto.

## Navegação
- `/conta` → clique em "Conectar Google Agenda"/"Conectar de novo" → tela de
  consentimento do Google (fora do app) → volta para `/conta` (conectado ou
  com aviso de cancelamento).
- `/compromisso/{id}` → "tentar de novo" → **sem navegação**, ação inline na
  própria tela.
- Nenhuma navegação nova sai do evento do Google Calendar nesta entrega (ver
  nota sobre link de volta, acima).

## Decisões de design e perguntas abertas
- Decisão: estado 1 ("não configurado") sempre com card visível explicando a
  ausência, nunca com o card inteiro escondido — consistência de layout e
  transparência sobre o que existe vs. o que está disponível agora.
- Decisão: incluir favorecido + valor no evento do Calendar (justificado
  acima) — reversível se o Mateus preferir um evento mais genérico.
- Decisão: sem botão "Desconectar" nesta entrega — pergunta aberta para o
  `po` sobre ticket futuro (acima).
- Pergunta para o `cto-obra`/`lead-engineer`: nome exato do parâmetro de query
  transitório de cancelamento OAuth e do campo/flag de falha de sincronização
  por compromisso — este spec descreve o comportamento, não o schema.
- Pendente: confirmação do `contador` sobre a frase de abertura da descrição
  do evento (ver seção anterior) — não bloqueia `/develop`, mas precisa
  voltar aqui se ele pedir outra redação.
