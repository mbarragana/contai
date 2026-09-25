# Gate 4 fechado, CONTAI-052 entregue — 2026-09-25

**9/9 critérios PASS.** Estágio ortogonal de extração de texto local
(`unpdf` → Groq texto → Gemini visão) em `lib/extracao/provider.ts`, prompt
centralizado (`lib/extracao/prompt.ts`), retry/timeout extraído para módulo
comum (`lib/extracao/retry.ts`) — fecha a **D70**. Ver critérios detalhados e
checados em `docs/tickets/CONTAI-052.md`.

## Critério por critério

1. Texto local sem API antes de qualquer IA — **PASS**.
2. Texto suficiente + `GROQ_API_KEY` presente → Groq, mesma estrutura
   `ExtracaoDocumento` — **PASS**.
3. Texto insuficiente ou Groq falha → cai no Gemini de hoje, sem diferença
   visível na tela — **PASS**.
4. Verificação campo-contra-fonte (`favorecidoDocumento`/`valorReais`
   literais no texto, senão `null` + `confianca: "baixa"`) — **PASS**.
5. Zero mudança de UX — **PASS**, nenhuma rota/tela tocada, E2E 296/296
   sem mudança desde o Gate 1.
6. `GROQ_API_KEY` ausente não bloqueia — **PASS**, confirmado ao vivo no
   Gate 3: log `[extracao] GROQ_API_KEY ausente — estágio de texto
   desligado, extração segue pelo Gemini`.
7. `AbortSignal.timeout()` por tentativa (Groq 10s — `lib/extracao/groq.ts`,
   Gemini 20s — `lib/extracao/gemini.ts`) + `maxDuration = 60` em
   `app/api/extrair-documento/route.ts` — **PASS**, conferido no código, não
   só no relato. Fecha a **D70**.
8. Cobertura de teste (heurística 3 fixtures, roteador 3 desvios,
   campo-contra-fonte, retry/timeout) + `npm run build` verde com `unpdf` em
   `dependencies` (não `devDependencies`) — **PASS**. 90/90 em
   `lib/extracao` (6 arquivos), suíte completa 1020 unitários verde,
   `npm run build` rodado neste Gate 4 e concluído sem erro (sem precisar de
   `serverExternalPackages` — o bundler não reclamou).
9. `.env.example` documenta `GROQ_API_KEY`/`GROQ_MODEL`/`EXTRACAO_TEXTO` ao
   lado do bloco do Gemini, repetindo a ressalva de nunca prefixar com
   `NEXT_PUBLIC_` — **PASS**, conferido no arquivo.

## Por que "vitória do processo", não ressalva

O Gate 2 técnico (`cto-obra`) testou com `unpdf` **real**, não mockado, e
achou um bug bloqueante: `provider.ts` passava `Buffer` para
`extrairTextoDoPdf`, e o PDF.js interno do `unpdf` **lança** com `Buffer`
(não é `Uint8Array` puro) — em produção, **todo** documento cairia em
silêncio no caminho do Gemini, e o ticket inteiro não faria nada. No mesmo
diff, o `lead-engineer` achou e corrigiu mais dois bugs não pedidos:
`Number("")` virando `0` (um R$ 0,00 fiscal **inventado** quando o texto
dizia "não consta") e um erro de separador de milhar pt-BR ("18.750" lido
como 18.75 — erro de 1000x) que também furava a guarda `conferirContraFonte`.
Isso é exatamente o tipo de risco que o critério 4 e o pre-mortem do ticket
existem para pegar — e foi pego **antes** de chegar em produção, pelo
processo (Gate 2 real, não mockado), não por sorte.

## Dívidas nomeadas (não bloqueantes)

- **D71 — caminho Groq nunca exercitado contra a API real.** `GROQ_API_KEY`
  ainda não existe (passo de dashboard do Mateus em
  `console.groq.com/keys`, pendente). Todos os 90 testes unitários mockam a
  chamada; o Gate 3 manual rodou sem a chave (estágio desligado) e viu só o
  caminho Gemini. Orientação operacional: depois que a chave existir na
  Vercel, conferir no log de produção que aparece `origem: "texto+groq"` ao
  menos uma vez — é a única forma de perceber se um bug de
  configuração/runtime como o do `Buffer` se repete no caminho Groq contra
  API de verdade, e nenhum teste local pega esse tipo de falha (o mesmo
  ponto cego estrutural do E2E local documentado no `CLAUDE.md`).
- **D72 — heurística de "texto suficiente" calibrada só com fixtures
  sintéticas.** As três fixtures de teste (texto legível, imagem pura,
  `(cid:N)` sem `ToUnicode`) são sintéticas, sem dado real da obra no
  repo. O pre-mortem do ticket (item 1) pedia testar explicitamente com um
  PDF de scan/foto real da obra para calibrar os thresholds (200 caracteres,
  5% de lixo); isso não foi feito neste Gate 4 — fica para quando aparecer
  um caso real de scan na captura do canteiro. Risco mitigado, não
  eliminado, pela segunda defesa (verificação campo-contra-fonte, que só
  rebaixa `confianca`, nunca afirma um valor não confirmado no texto).

Nenhuma das duas dívidas é obrigação fiscal nem risco de "documento sem
sustentação": nos dois casos, se o texto for ambíguo ou o Groq falhar, o
pipeline cai no Gemini (caminho já validado) ou a extração simplesmente não
sugere nada — o "Salvar" manual continua sendo quem afirma o registro.

## Fila

`CONTAI-052` sai da fila de implementação — **fila de implementação volta a
vazia**. `docs/tickets/README.md` e `docs/backlog.md` atualizados.
