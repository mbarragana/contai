# CONTAI-048 — Ver o anexo ao lado do formulário em `/adicionar/documento`

Gate 0. Delta em cima do `CONTAI-047` (`app/_components/captura.tsx`,
`GradeDaCaptura`, rail com miniatura 52×52 + resumo) — só o card "Arquivo"
do rail muda; nada mais na tela. Protótipo companheiro: `CONTAI-048.html`
(vazio/imagem/pdf × piso 375/larga 900, com lightbox funcional).

## Decisão de layout (resumo)

Dois níveis, não um painel fixo largo:
1. **Inline, no card "Arquivo" do rail** (mesma largura de sempre, ~296px) —
   só IMAGEM: a miniatura 📄 vira `<img>` real, maior (~120px de altura,
   `object-fit: cover`) — confirma "é este o papel", não lê valor miúdo.
2. **Lightbox sob demanda** (modal por cima de tudo, fora da grade) — imagem
   (zoom) e PDF (viewer nativo do navegador). É aqui que CNPJ/valor/data
   ficam legíveis. Botão "🔍 Ver documento" abre; fechado, não ocupa espaço.

Isto evita reabrir a largura da casca (herdada do `047`, ~940px "rail
incluso" — `docs/backlog/59-…md` item 3): o lightbox mora por cima da grade,
não compete por coluna.

## Telas e estados

**A — vazio.** Sem mudança: `CampoArquivo` como hoje, sem placeholder de
visualização (caixa vazia antes de haver o que mostrar não vale o espaço).

**B — imagem, `larga` (≥880px).** Miniatura vira `<img>` (blob URL) 100% da
largura do card × 120px, cantos arredondados, `object-fit: cover`, no lugar
do emoji — nome/tamanho/"Trocar arquivo" como hoje. Abaixo, botão ghost
full-width **"🔍 Ver documento"**, abre o Lightbox (E).

**C — PDF, `larga`.** Miniatura continua ícone 📄 (thumbnail de PDF no
cliente sem lib nova não paga esta feature). Ganha o mesmo botão **"🔍 Ver
documento"**, empilhado ACIMA de "🪄 Extrair dados da nota (beta)" — ver o
papel antes de rodar IA sobre ele é a ordem que faz sentido.

**D — XML.** Sem botão, sem viewer. Marcação bruta não ajuda a conferir
CNPJ/valor/data, e a extração de XML (fast-xml-parser) já é determinística —
não depende de conferência visual como o PDF via Gemini (beta). Card fica
igual ao que o `047` já entrega.

**E — Lightbox (qualquer largura).** Overlay escuro, painel branco
centralizado, `role="dialog" aria-modal="true"`, título + nome do arquivo, X
no canto, fecha por X/Esc/clique fora, foco preso dentro.
- **Imagem**: `<img>` contida (`object-fit: contain`, até ~85vh/720px);
  toggle **"Ajustar" / "Ampliar (100%)"** — em "Ampliar", `overflow: auto`
  para rolar/arrastar; `touch-action` padrão (não desabilitar) para pinça
  nativa no celular.
- **PDF**: `<object data={blobUrl} type="application/pdf">`, ~90vh × até
  800px. O viewer nativo do navegador já traz zoom/paginação/busca — resolve
  a pergunta do ticket ("PDF multi-página?") sem código novo. Fallback via
  `children` do `<object>` (não `<embed>` sozinho).
- **Erro/sem suporte** (critério 2, nunca bloqueia): "Não foi possível
  exibir este arquivo aqui" + link `download`. Nunca erro de tela, nunca
  impede salvar.

**F — piso (<880px).** Miniatura grande de B/C não aparece (rail continua
`hidden larga:flex`). A linha de sucesso do `CampoArquivo` ("nome.pdf ✓ vai
para o acervo") ganha, ao lado, o link **"Ver documento"** — mesmo Lightbox
de E, agora `100vw/100dvh`. Extensão do critério 5 do ticket (que previa
"sem mudança" no piso): aceitável por ser on-demand, um clique, sem campo
nem passo novo no caminho de captura — mesma lógica que abriu o `CONTAI-047`
para o celular. Sem XML: mesma regra de D.

## Campos
- SEM CAMPOS — nenhum campo novo, nenhuma mudança de nome/tipo/validação.
  `notaNoCpf`, `retencao_na_nota` e `cnoNaNota` continuam perguntas ao
  usuário; o preview não lê nem sugere resposta a nenhuma (critério 4 do
  ticket).

## Textos com consequência fiscal
Nenhum texto fiscal novo ou alterado. Gate fiscal do ticket é sanity check
apenas ("preview client-side não interfere em nota no CPF/CNO") — sem texto
novo para o `contador` revisar.

## Navegação
"Ver documento" não é rota: abre o Lightbox por cima da tela atual (estado
local do componente), sem perder o que já foi digitado. Fechar volta ao
mesmo scroll/estado. Stepper continua em 3 passos.

## Decisões e perguntas abertas
- **Blob URL**: `URL.createObjectURL(arquivo)` ao mudar `arquivo`;
  `URL.revokeObjectURL` no cleanup (troca/desmonte) — nota para o Gate 1.
- **Por que não crescer a coluna do rail** para caber o PDF inline: fechado
  em `docs/backlog/59-…md` item 3 — 940px já é "rail incluso"; um teto novo
  reabre a discussão que o Gate 2 do `CONTAI-039` já fechou (largura maior
  lê pior). O lightbox contorna sem pedir mais coluna.
- **Aberto para o `cto-obra`**: suporte a `<object type="application/pdf">`
  é desigual em navegador mobile — se o fallback de download for comum no
  uso real, ele deixa de ser exceção; validar com um PDF real antes do
  Gate 1.
- **Não bloqueia**: se `pagamento`/`compra-cartao` ganharem rail no futuro
  (fora de escopo hoje), este Lightbox é reaproveitável sem redesenho.
