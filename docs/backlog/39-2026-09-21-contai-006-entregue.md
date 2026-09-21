# CONTAI-006 entregue — 2026-09-21

Estados de rede lenta e indisponível: a política de rede virou única
(`lib/rede.ts`), com `db.retry:false` desligando o retry nativo do
postgrest-js. Leitura: 3 tentativas, esperas 400ms/1200ms, 2,5s por tentativa,
teto de 5s — sobe para "sem resposta do servidor, tentando de novo" aos ~2s,
sempre reflete a falha real (nunca "carregando" depois de saber que a primeira
tentativa falhou). Gravação: 1 tentativa, nunca repetida, teto de 10s — erro
distingue "não foi salvo" (resposta recebida, ex. 503 com corpo) de "não deu
para confirmar" (sem resposta nenhuma, manda conferir antes de repetir para
não duplicar). GoTrue e upload ao Storage ficam fora da política de propósito
(custo de navegação do critério 9; upload em 4G excede qualquer teto de tela).

`Carregando` (`app/_components/ui.tsx`) virou a máquina de 4 níveis usada por
45 usos em 38 arquivos; novo trio `BotaoSalvar`/`AvisoDeGravacao`/
`ErroDeGravacao` para o lado de escrita. `mensagemDeErroDeGravacao(erro, onde)`
gera o texto de "resultado incerto" variando o `{onde}` por tela.

Gate 2 (`cto-obra`) voltou APPROVE com 3 pendências pequenas; a 1ª foi corrigida
no mesmo commit (aviso de "sem resposta" disparava também em escrita, inclusive
em 503 com corpo — falso nos dois casos; movido para dentro do ramo repetível,
com 2 testes novos). Decisão do `cto-obra` sobre a tensão critério 3 × critério
8: a única falsificação de rede permitida em E2E continua sendo o 503 do
PostgREST; o teto de leitura ("request que nunca responde") se prova por
teste unitário com relógio injetado, não por rota que pendura no Playwright —
isso testaria o timeout do WebKit, não o sistema.

Testado: 817 unitários (2 novos) + 220/220 E2E + validação manual no browser
(Postgres local pausado/despausado: leitura mostrando os 3 níveis com o texto
exato do spec; gravação com 503-com-corpo mostrando erro definitivo; gravação
com Kong+PostgREST pausados via `docker pause` mostrando "Ainda salvando…" e
depois o texto incerto exato do critério 6; ambiente restaurado sem registro
órfão nem duplicado). Gate 4 (`po`) PASS nos 9/9 critérios.

Sem migration.

## Dívidas nomeadas

- **D64** — upload ao Storage não tem teto próprio: "Ainda salvando… não feche"
  pode durar até o timeout TCP do browser em vez de um teto curto e um texto
  de resultado incerto. Não duplica nada (path com UUID novo a cada tentativa,
  gerado antes do INSERT) — não bloqueou este ticket. Caminho futuro: teto
  próprio via `AbortSignal` no `.upload` (ex.: 90s), com o mesmo texto de
  resultado incerto do critério 6.
- **Observação, não dívida**: `TETO_DE_LEITURA_MS` (5000ms) foi escolha do
  `lead-engineer` no limite superior que o próprio Mateus citou na Pergunta
  Aberta 3 do ticket, não uma resposta direta dele — as Perguntas Abertas 1-3
  seguem sem resposta. Revisitar se ele responder depois.
