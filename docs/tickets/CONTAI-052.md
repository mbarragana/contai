# CONTAI-052 Extração de texto local do PDF antes de chamar IA de visão, com Groq como provedor de texto

## Tipo e Prioridade
melhoria de pipeline — **P1, fricção de processo recorrente** (não obrigação
fiscal: nenhuma das três metas do produto é bloqueada sem isto — a extração já
hoje só sugere, e o registro manual continua funcionando mesmo com o Gemini
fora do ar). Zero mudança de tela/UX.

## Dor de Origem
Três incidentes na extração automática (US-008 Fase 2) no mesmo dia,
2026-09-24, detalhados em
`docs/backlog/67-2026-09-24-incidente-extracao-gemini.md`:

1. Rodada 1 — `maxOutputTokens` era teto TOTAL (raciocínio + JSON); o
   `gemini-3.5-flash` "pensava" até estourar o teto e devolvia `MAX_TOKENS`
   sem texto nenhum. Corrigido (`6bc0e66`).
2. Rodada 2 — o fix da rodada 1 (`thinkingLevel: "minimal"`) quebrou em
   produção com 400 porque o modelo real por trás do fallback
   (`gemini-flash-latest` → `gemini-3.8-flash`) rejeita esse nível. Corrigido
   (`4be9107`).
3. Rodada 3 — retry automático implementado para 429/5xx/falha de rede
   (commit pendente de push), mas **não resolve tudo**: um 503 de
   indisponibilidade persistiu 20 minutos.

**Achado lateral que motiva este ticket**: ao testar contra a API real, um
429 nomeou o limite exato — `generate_content_free_tier_requests`, **5
requisições por minuto** no tier gratuito do Gemini. Parte da "frequência" do
erro não é bug, é cota. Conversa direta do Mateus com o coordenador no mesmo
dia decidiu a ideia deste ticket: tirar uma fatia real dos documentos do
caminho que está no limite, processando-os com um provedor de cota separada.

## Ideia (decidida pelo Mateus — não é hipótese do `po`)

1. Antes de mandar qualquer documento para IA de visão, tentar extrair o
   **texto embutido** do PDF **localmente, sem chamar API nenhuma**. A
   maioria das NF-e/NFS-e/boletos é gerada digitalmente por sistema (tem
   camada de texto); só foto/scan sem OCR não tem.
2. **Se a extração de texto for suficiente**: mandar esse **texto** (não mais
   o PDF) para a **Groq**, modelo de texto. Motivo de trocar de provedor
   aqui — não só reduzir payload: a Groq tem **cota separada** da do Gemini,
   então esses documentos saem por completo do caminho que está no limite de
   5 req/min, não ficam só "mais leves" nele.
3. **Se a extração de texto falhar** (PDF é imagem/scan sem camada de texto,
   ou é foto tirada no canteiro convertida em PDF): cai no caminho de hoje —
   manda o arquivo original para o Gemini, que já tem retry automático
   (commit `4f8a1c6`).
4. Groq como **fallback de visão** (para foto/scan) é uma ideia diferente,
   avaliada e explicitamente fora de escopo aqui — ver "Fora de Escopo".

## User Story
Como dono da obra clicando "Extrair dados da nota" numa NFS-e/boleto gerado
digitalmente, quero que a extração use um caminho que não dependa da cota
apertada do Gemini, para não ver a extração falhar por limite de requisições
em documentos que nem precisavam de IA de visão para começo de conversa.

## Decisões técnicas (fechadas pelo `cto-obra` em 2026-09-24, antes do Gate 1)

Consulta completa registrada em
`docs/backlog/68-2026-09-24-decisoes-tecnicas-contai-052.md`. Resumo por
decisão:

**Fato que redefine o passo 3 do escopo**: `app/api/extrair-documento/route.ts`
hoje **rejeita tudo que não é `application/pdf`** (400). "Foto do canteiro"
só entra nesta rota se já estiver dentro de um PDF (scan/foto convertida) —
aceitar JPEG/HEIC direto é mudança de rota, fora deste ticket.

1. **Biblioteca**: `unpdf` (unjs, v1.8.1) — `extractText(bytes, { mergePages:
   true })`. É a única das três candidatas feita para serverless: embute o
   worker do PDF.js no bundle, sem DOM, sem binário nativo. `pdf-parse` 2.x
   arrasta `@napi-rs/canvas` (nativo) como dependência dura mesmo sem
   renderizar imagem; `pdf-parse` 1.x está morto e lê arquivo de teste no
   `import` (proibido); `pdfjs-dist` puro exige configurar worker manualmente.
   Roda em runtime **Node** da rota (nunca `edge`); se o bundler reclamar,
   `serverExternalPackages: ["unpdf"]` em `next.config.ts` — confirmar com
   `npm run build`, não só `dev`. Teto de 30.000 caracteres / 5 primeiras
   páginas antes de mandar à Groq.
2. **Prompt**: extrair o bloco de regras fiscais de `gemini.ts` (`PROMPT`)
   para `lib/extracao/prompt.ts` como fonte única (`REGRAS_EXTRACAO`) — as
   regras ("favorecido = quem emitiu", "valor BRUTO", "não classifique
   retenção") não podem divergir entre provedores. Cada provedor concatena um
   sufixo próprio. Chamada Groq: formato OpenAI
   (`api.groq.com/openai/v1/chat/completions`), `temperature: 0`,
   `response_format: { type: "json_object" }` — **não** usar `json_schema`
   estrito (só disponível nos modelos `gpt-oss`/`qwen`, que são modelos de
   raciocínio e reproduziriam a armadilha de `MAX_TOKENS` da rodada 1 do
   incidente). Validação continua pelo `ExtracaoDocumentoSchema.safeParse`
   já existente.
3. **Abstração**: **não** é um `case` novo em `EXTRACAO_PROVIDER` — é um
   estágio **ortogonal**, antes da escolha de provider, em `provider.ts`:
   texto local → se suficiente e `GROQ_API_KEY` presente → Groq (texto); se
   falhar/insuficiente → Gemini (arquivo original, caminho de hoje, intacto).
   `EXTRACAO_PROVIDER` continua só para o provedor de **visão**. Nova env
   `EXTRACAO_TEXTO=groq|off`. O roteador expõe `origem:
   "texto+groq"|"visao+gemini"` só para log — não entra no
   `ExtracaoDocumentoSchema` nem na UI.
4. **Heurística "texto suficiente"** — três testes cumulativos, em
   `lib/extracao/texto-pdf.ts`: (a) ≥200 caracteres não-brancos; (b) ≤5% de
   caracteres-lixo (`U+FFFD`, controle, private-use, `(cid:N)` — fonte sem
   `ToUnicode`); (c) presença de pelo menos um CNPJ/CPF **e** um valor
   monetário pt-BR no texto. **Segunda defesa, depois do `safeParse`**:
   `favorecidoDocumento` e `valorReais` têm que aparecer literalmente no
   texto bruto — se não aparecerem, o campo vira `null` e `confianca` vira
   `"baixa"` (nunca sobe, só rebaixa). Datas e número da nota ficam fora dessa
   checagem (múltiplas ocorrências geram falso positivo). Fixtures de teste
   sintéticas (sem dado real da obra no repo); thresholds são valores
   iniciais, o `lead-engineer` calibra com o PDF real de sondagem
   (localmente, não commitado) e registra o que mediu.
5. **`confianca`**: mesmo enum (`alta/media/baixa`), critério muda por
   modalidade — visão julga legibilidade da imagem (como hoje); texto julga
   **ambiguidade** (campo único e claro = alta; múltiplos candidatos = média;
   texto fragmentado/contraditório = baixa). Doc-comment de `confianca` em
   `schema.ts` precisa cobrir as duas leituras.
6. **Retry/timeout**: extrair o laço já implementado em `gemini.ts` (backoff
   1s/3s, `Retry-After` ≤5s, 3 tentativas) para `lib/extracao/retry.ts` e
   reusar nos dois provedores — não simplificar para a Groq. Novo:
   `AbortSignal.timeout()` por tentativa (Groq 10s, Gemini 20s) e
   `export const maxDuration = 60` na rota — **fecha a dívida D70** (timeout
   ausente, nomeada no Gate 2 do retry). Orçamento pior caso (~98s, ambos
   provedores esgotando retry) excede os 60s e é aceito: exige os dois fora
   do ar ao mesmo tempo, a rota devolve 502/504 e a UI trata como "preencha à
   mão", igual hoje.
7. **Env/migration**: **sem migration** (extração é stateless). Novas env
   servidor-only: `GROQ_API_KEY` (própria do contai — console.groq.com/keys,
   **não** reaproveita a do `../garmin-import`), `GROQ_MODEL` (default
   `llama-3.3-70b-versatile`), `EXTRACAO_TEXTO` (`groq` default | `off`).
   `GROQ_API_KEY` ausente = estágio de texto desligado com `console.warn`,
   cai direto no Gemini — não bloqueia deploy antes da chave existir na
   Vercel. `unpdf` entra em `dependencies` (roda em produção). CI do job
   `quality` continua sem precisar de `GROQ_API_KEY` (fetch mockado nos
   testes unitários, como já é para o Gemini); job `e2e` não muda — o E2E só
   toca o botão "Extrair dados da nota" na tela, nunca a rota com provedor
   real.

**Arquivos previstos**: `lib/extracao/provider.ts`, `lib/extracao/gemini.ts`,
`lib/extracao/groq.ts` (novo), `lib/extracao/texto-pdf.ts` (novo),
`lib/extracao/prompt.ts` (novo), `lib/extracao/retry.ts` (novo),
`lib/extracao/erros.ts` (novo — `ExtracaoIndisponivelError` sai de
`gemini.ts` para módulo neutro), `lib/extracao/schema.ts` (só doc-comment),
`app/api/extrair-documento/route.ts`, `.env.example`, `package.json`,
possivelmente `next.config.ts`.

## Escopo e Critérios de Aceite

1. Documento anexado em `/adicionar/documento` cujo PDF tem camada de texto
   suficiente (heurística do critério 4 acima) tem o texto extraído
   **localmente, sem nenhuma chamada de API**, antes de qualquer IA ser
   acionada.
2. Se o texto for julgado suficiente **e** `GROQ_API_KEY` estiver configurada,
   a extração roda via Groq (texto), devolvendo a mesma estrutura
   `ExtracaoDocumento` de hoje — nenhum campo novo, nenhum campo removido.
3. Se o texto for insuficiente (scan/foto sem camada de texto), **ou** a
   chamada à Groq falhar (`ExtracaoIndisponivelError` esgotando retry, ou
   resultado vazio/inválido no schema), o pipeline cai automaticamente no
   caminho de hoje — Gemini com o arquivo original, preservando o retry já
   implementado (commit `4f8a1c6`). Usuário não vê diferença nenhuma na tela
   entre os dois caminhos além do resultado preenchido.
4. Verificação campo-contra-fonte no caminho texto: `favorecidoDocumento` e
   `valorReais` só ficam preenchidos se aparecerem literalmente no texto
   extraído; caso contrário, o campo volta a `null` e `confianca` é
   rebaixada para `"baixa"` — nunca o inverso.
5. **Zero mudança de UX**: mesmo botão "Extrair dados da nota", mesmos campos
   no formulário, mesmo comportamento de "extração só sugere". Nenhuma
   mudança em `notaNoCpf`, `retencao_na_nota`/`retencao11` ou `cnoNaNota` —
   esses continuam pergunta ao usuário, nunca inferência de texto/imagem.
6. `GROQ_API_KEY` ausente em produção não bloqueia nada: o estágio de texto
   fica desligado (log de aviso), extração cai direto no Gemini, igual ao
   comportamento pré-ticket.
7. `AbortSignal.timeout()` por tentativa nos dois provedores (Groq 10s,
   Gemini 20s) e `maxDuration = 60` na rota — fecha a **dívida D70**.
8. Cobertura de teste unitário (Vitest, sem rede real): heurística de texto
   suficiente com as 3 fixtures descritas (texto legível, imagem pura,
   `(cid:N)` sem `ToUnicode`); roteador texto→Groq→Gemini com os dois
   provedores mockados, cobrindo os 3 desvios (texto insuficiente, Groq
   falha, Groq devolve resultado válido); verificação campo-contra-fonte
   rebaixando `confianca`; retry/timeout reaproveitado (dos 20 testes
   existentes do Gemini, adaptado para os dois provedores). `npm run build`
   verde com `unpdf` no bundle serverless.
9. `.env.example` documenta as três env novas (`GROQ_API_KEY`, `GROQ_MODEL`,
   `EXTRACAO_TEXTO`) ao lado do bloco do Gemini, com a mesma ressalva de
   nunca prefixar com `NEXT_PUBLIC_`.

## Fora de Escopo
- **Groq como fallback de visão** (para foto/scan sem texto): o único modelo
  de visão da Groq hoje (`qwen/qwen3.8-27b`) não aceita PDF direto, só
  imagem — exigiria conversão PDF→imagem em ambiente serverless, complexidade
  nova. Avaliado e explicitamente cortado desta rodada, não pendência a
  resolver.
- **Aceitar JPEG/HEIC direto na rota** `app/api/extrair-documento` — hoje ela
  só aceita `application/pdf`; mudar isso é decisão de UX/rota nova, fora
  daqui.
- **Agendador de deadline total** entre as duas cadeias de retry (Groq + fallback
  Gemini, ~98s pior caso, acima do `maxDuration=60`) — aceito como está;
  exige os dois provedores fora do ar simultaneamente, e a UI já trata falha
  de rota como "preencha à mão". Vira ticket próprio só se aparecer no log de
  produção.
- **Claude API como provedor de visão** — continua fora, documentado desde o
  `provider.ts` original; entra como `case` novo se algum dia for preciso,
  sem redesenho.
- Qualquer mudança em `lib/fiscal/*`, no gate de campos fiscais ou na lógica
  de "Salvar".

## Gate Fiscal (Contador)
**Sanity check concluído em 2026-09-24 — APROVADO, sem parecer formal
necessário.** Confirmado contra o código (`lib/extracao/schema.ts`,
`provider.ts`), não só contra o relato do ticket:
- O contrato `ExtracaoDocumento` não muda — nenhum campo fiscal
  (`notaNoCpf`, retenção, CNO) é lido ou inferido pela extração, em nenhum
  dos dois provedores; essa fronteira já está fixada no schema desde o
  CONTAI-038 (critério 14), independente de quem faz o OCR/parse.
- Trocar de provedor de IA (Gemini↔Groq) para a mesma finalidade de
  sugestão não move nem cria fato fiscal novo — documentação hábil (IN SRF
  84/2001 art. 17) é sobre o documento que o Mateus guarda e declara, não
  sobre qual terceiro o leu primeiro.
- A extração continua só sugerindo — quem afirma é o "Salvar" manual,
  independente do provider.
- Ponto levantado e explicitamente separado como **não fiscal**: mandar o
  *texto* de uma nota para um provedor americano (em vez de imagem) pode ser
  mais fácil de reter/logar do lado dele — isso é uma questão de
  privacidade/LGPD, categoria fora do escopo do `contador`, registrada aqui
  como ressalva de produto, não como pendência fiscal.

## Pre-mortem
1. **PDF-imagem processado como se fosse texto legível** — é o risco central
   do ticket; mitigado pela heurística de 3 testes (critério 4) mais a
   verificação campo-contra-fonte, que rebaixa em vez de aceitar um valor
   plausível mas inventado. Testar explicitamente com um PDF de scan/foto
   real da obra (localmente, não commitado).
2. **Confiança "alta" indevida no caminho texto** por ambiguidade não
   detectada (dois CNPJs, dois valores) — o sufixo de prompt do critério 5
   existe para isso; testar com um PDF que tenha duas ocorrências de CNPJ
   (emitente + tomador).
3. **`GROQ_API_KEY` vazando para o bundle do browser** se alguém prefixar com
   `NEXT_PUBLIC_` por engano — mesma disciplina do `GEMINI_API_KEY`, checar
   no `.env.example` e no Gate 2 técnico.
4. **Retry duplicado estourando o timeout da função serverless** — orçamento
   pior caso (critério 7/decisão 6) já mapeado e aceito; não é surpresa se
   acontecer, mas o Gate 2 deve confirmar que os dois `AbortSignal.timeout()`
   e o `maxDuration=60` realmente estão no código, não só no ticket.

## Dependências
- Nenhuma migration.
- Nenhum `/design` — zero mudança de tela/UX, confirmado no critério 5.
- `GROQ_API_KEY` própria do contai precisa ser criada em
  console.groq.com/keys antes do primeiro deploy com o estágio de texto
  ligado (passo de dashboard do Mateus, mesma categoria dos passos já
  listados no `CLAUDE.md` para o Supabase) — até lá, `EXTRACAO_TEXTO` cai
  para "desligado" sozinho, sem bloquear nada.

## Cenário e checagem final
Pipeline de servidor, invisível ao usuário nos dois cenários (gestão em casa
e captura no canteiro) — não se aplica "Teste do Canteiro" nem cenário de
tela, porque não há tela nova nem existente que mude.

## Veredicto (po, 2026-09-24)

✅ **PRONTO PARA `/develop`.**

- **Decisões técnicas** — fechadas pelo `cto-obra` antes do Gate 1 (ver seção
  acima e `docs/backlog/68-2026-09-24-decisoes-tecnicas-contai-052.md`), para
  não virar ping-pong no Gate 2.
- **Gate Fiscal** — sanity check do `contador`, APROVADO, sem parecer formal
  necessário.
- **Gate 0 (`/design`)** — não se aplica, zero mudança de UX.
- Sem dependência bloqueante; `GROQ_API_KEY` ausente degrada para o
  comportamento de hoje, não trava desenvolvimento nem deploy.
