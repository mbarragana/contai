# CONTAI-048 Anexo visível ao lado do formulário em `/adicionar/documento`

## Tipo e Prioridade
feature — **P1, fricção de processo** (não obrigação fiscal: nenhum
relatório, aferição ou acervo depende disto; nenhuma das três metas do
produto é bloqueada sem ele). **Não bloqueia nem é bloqueado pelo
`CONTAI-047`** — reaproveita a casca larga que ele cria, mas nasce depois,
com `/design` próprio, e pode ficar no backlog "Depois" sem travar nada.

## Dor de Origem
Achado do `cto-obra` na consulta técnica de 2026-09-22 sobre o `CONTAI-047`
(`docs/backlog/58-2026-09-22-captura-tela-larga-contai-047-048.md`), a partir
da própria frase do Mateus — *"vi `/adicionar/documento` esticada sem nenhum
aproveitamento de tela larga"*: o ganho real de estar num monitor largo
registrando um documento não é ter os campos lado a lado (isso o `CONTAI-047`
resolve), é poder **ver a nota/o boleto anexado ao lado do formulário**
enquanto confere os valores extraídos ou digitados — hoje, mesmo em tela
larga, o arquivo fica só como anexo invisível até salvar; conferir CNPJ,
valor e data significa alternar entre o formulário e o PDF/foto aberto em
outro lugar (ou o papel físico do lado do teclado). É fricção que **aumenta o
risco de erro de transcrição** num campo que alimenta custo de aquisição —
toca a meta 1 (documento hábil) de forma indireta, não é conveniência pura.

⚠️ **Fronteira com o `CONTAI-047` fechada em 2026-09-22.** O Gate 0 do `047`
(`design/mocks/captura-no-desktop-v1.md`, Decisões 2 e 3) desenhou um rail
lateral para `documento/page.tsx` que **parece** cobrir esta dor, mas não
cobre: o que o rail mostra é uma **miniatura 52×52** do arquivo (nome +
tamanho + "Trocar arquivo") e um resumo somente-leitura do que o *usuário já
digitou* — não dá para ler CNPJ, valor ou data numa miniatura desse tamanho,
e o resumo é o dado já afirmado, não o documento em si. A dor que este ticket
resolve — ver o PDF/foto grande o bastante para **ler e conferir contra o
formulário** — continua sem desenho. O `047` absorveu o reposicionamento
(miniatura + botão de extração), não a leitura.

## User Story
Como dono da obra registrando uma nota em `/adicionar/documento`, sentado no
desktop, depois de anexar o arquivo (PDF, XML ou foto), quero ver o documento
anexado ao lado do formulário enquanto preencho ou confiro os campos
extraídos, para não precisar alternar de janela nem confiar de memória no que
o papel dizia.

## Gate 0 (mock) — FECHADO em 2026-09-23

`design/mocks/CONTAI-048.md` + `CONTAI-048.html` (protótipo navegável,
vazio/imagem/PDF × piso 375/larga 900, lightbox funcional). Decisão de
layout: miniatura inline maior só para imagem no rail (~296px, sem ler texto
miúdo) + Lightbox sob demanda (modal, fora da grade) que é onde CNPJ/valor/
data ficam legíveis — imagem com zoom, PDF com `<object type="application/pdf">`
e o viewer nativo do navegador. XML sem preview (extração já é determinística).
Estende o critério 5 no piso (<880px): "Ver documento" abre o mesmo Lightbox
em tela cheia, on-demand, sem campo nem passo novo no caminho de captura.

⚠️ **Achado do `cto-obra` na consulta técnica de 2026-09-23 muda o Estado F
do mock (PDF em tela estreita/touch) — ver "Escopo e Critérios de Aceite",
critério 3, e "Dependências" abaixo.** Não reabre o resto do Gate 0.

## Escopo e Critérios de Aceite
*Fechado em `/design` (ver "Gate 0" acima), com um ajuste pontual no
critério 3 abaixo, decidido depois do Gate 0 por achado técnico do
`cto-obra`.*

1. Em telas largas (acima do breakpoint que o `CONTAI-047` define), depois de
   um arquivo ser anexado, o formulário de `documento/page.tsx` mostra o
   arquivo ao lado dos campos — `<object>`/`<img>` a partir de blob URL local
   (achado do `cto-obra`: viável sem migration, sem subir o arquivo de novo,
   sem round-trip de rede).
2. **Não é obrigatório nem impede salvar** — é conveniência de conferência,
   nunca gate. Falha ao renderizar o preview (formato não suportado, PDF
   grande) não pode bloquear o registro nem virar erro de tela: degrada para
   o comportamento de hoje (arquivo só como anexo).
3. **PDF multi-página — decidido no Gate 0, ajustado em 2026-09-23 por achado
   técnico do `cto-obra`.** O mock resolveu com `<object type="application/pdf">`
   dentro do Lightbox, contando com o viewer nativo do navegador para
   zoom/paginação/busca — funciona em desktop (macOS Safari/PDFKit, Chrome,
   Firefox). **Em iOS/WebKit (o alvo real de captura) isso é enganoso, não
   quebrado**: o `<object>` não cai no fallback de download (o risco que o
   `designer` havia levantado) — ele **renderiza e trava na 1ª página**, sem
   scroll interno, sem toolbar, sem zoom próprio (pinch amplia a página
   inteira, não navega). Documento de 3 páginas mostra 1 e nenhuma indicação
   de que há mais. Isso é degradação silenciosa: não dispara o `children` do
   `<object>`, não aparece no CI (Playwright/WebKit em Linux não tem viewer
   de PDF nenhum — o CI só prova o caminho de fallback/imagem, nunca o
   comportamento real do Safari iOS).
   **Correção de critério, por dispositivo de entrada** (`cto-obra`,
   2026-09-23): em telas largas/mouse, mantém `<object>` + fallback do mock,
   inalterado. **Em tela estreita/touch (Estado F do mock, piso), PDF não
   embuti no Lightbox** — vira link `<a href={blobUrl} target="_blank"
   rel="noopener">Abrir PDF</a>` dentro do próprio card, que abre o visualizador
   nativo de aba inteira do iOS (todas as páginas, pinch zoom, compartilhar).
   Imagem continua com o Lightbox modal em qualquer largura — só PDF muda por
   tipo de entrada. Isto é ajuste ao **Estado F** do mock (não reabre B/C/D/E);
   registrado aqui em vez de novo ciclo de `/design` porque a correção é
   mecânica e sem ambiguidade de fluxo (troca de primitiva HTML, não de tela).
4. Sem efeito em `notaNoCpf`, `retencao_na_nota`, `cnoNaNota` ou qualquer
   outro campo fiscal — o preview é só leitura visual, nunca preenche nem
   sugere resposta (mesma regra da extração automática, US-008: só sugere
   texto em campo de dado, nunca em pergunta fiscal).
5. Em telas estreitas (canteiro, 375px) — sem mudança nenhuma. O preview lado
   a lado só existe onde há largura para os dois; no celular o anexo continua
   como hoje (thumbnail/confirmação de anexado, sem preview grande).

## Fora de Escopo
- `pagamento/page.tsx` e `compra-cartao/page.tsx` — o comprovante desses dois
  fluxos é mais simples (um PIX, um recibo) e não tem extração para conferir
  campo a campo; se a mesma dor aparecer lá depois de um relato, é ticket
  novo, não extensão silenciosa deste.
  Aplica só a `documento/page.tsx` por ser onde a extração (fase 2, US-008)
  soma valor real à conferência lado a lado.
- Qualquer mudança na extração em si (`lib/extracao/`), no gate fiscal de
  campos, ou na lógica de salvar.
- Anotar ou marcar o documento (realçar o campo que originou um valor
  extraído) — é um passo natural depois deste, mas não nasce junto.

## Gate Fiscal (Contador)
Sanity check, sem regra nova esperada: confirmar que um preview client-side
do arquivo não interfere em nenhuma leitura de "nota no CPF" ou "CNO
impresso" — essas continuam perguntas ao usuário, nunca inferência de imagem.

## Pre-mortem
1. **Preview de PDF grande travando a tela** no canteiro se o breakpoint for
   mal calibrado e a captura pequena tentar renderizar mesmo assim — critério
   5 existe para isso; testar explicitamente o corte de largura.
2. **Confundir "ver o anexo" com "a extração acertou"** — o preview mostra o
   arquivo, não valida o que foi digitado contra ele; nenhum texto de tela
   pode sugerir conferência automática que não existe.

## Dependências
- **Depende da casca larga do `CONTAI-047`** só como pré-condição de espaço
  (não há onde pôr um preview ao lado sem a coluna já ter crescido) — não
  bloqueia o `047`, que entrega valor sozinho. O `047` fechou o breakpoint em
  ~900px (rail incluso) — este ticket herda esse valor, não escolhe um novo.
- ~~**Precisa de `/design` próprio**, ainda não escrito~~ ✅ **Gate 0 FECHADO
  em 2026-09-23** — `design/mocks/CONTAI-048.md`/`.html`, ver seção "Gate 0"
  acima. Não é o mesmo Gate 0 do `047`: o rail do `047` cobre miniatura +
  resumo do digitado, este cobre a leitura do documento (Lightbox).
- **Consulta técnica ao `cto-obra` sobre PDF em navegador mobile — RESPONDIDA
  em 2026-09-23**, incorporada ao critério 3 acima. Resumo: `<object>` não
  cai em fallback de download no iOS (o risco que o `designer` temia) — o
  risco real é diferente e pior, **renderiza travado na 1ª página, sem
  aviso**. Correção: PDF em tela estreita/touch abre em nova aba
  (`<a target="_blank">`), não embutido no Lightbox; desktop mantém o mock
  como desenhado.
  **Notas técnicas para o Gate 1** (do `cto-obra`, sem teste manual ainda):
  revogar o blob URL só ao fechar o Lightbox/trocar arquivo, nunca em
  `onLoad`; remontar o `<object>` com `key={blobUrl}` quando o `data` mudar
  (Safari/Chrome não recarregam sozinhos); abrir em nova aba só dentro do
  gesto de toque (`<a target="_blank">`, nunca `window.open` depois de um
  `await`); `download` de blob funciona em iOS ≥ 13.
  ⚠️ **Continua exigindo teste manual antes de fechar o Gate 1 de vez**:
  iPhone real (Safari) + macOS Safari, com uma NFS-e PDF real de ≥ 2 páginas
  — confirmar que renderiza, chega na página 2 (ou abre certo na aba nova, no
  caso mobile) e que CNPJ/valor ficam legíveis com zoom. Nem o CI local nem o
  `webkit` do Playwright (que roda em Linux) provam isso.

## Cenário e checagem final
**Captura em tela larga** — em casa, sentado, conferindo uma nota antes de
salvar. Não se aplica ao "Teste do Canteiro": em 375px o comportamento não
muda (critério 5).

⚠️ **Nota do `po`, 2026-09-23**: esta frase ficou desatualizada pelo próprio
Gate 0 — o mock desenhou o Estado F (link "Ver documento" abrindo o mesmo
Lightbox em 375px), uma extensão explícita e assumida do critério 5 ("sem
mudança" virou "sem campo nem passo novo", não "sem nenhum acesso ao
documento"). O "Teste do Canteiro" segue não sendo a régua que trava esta
tela (doutrina de 2026-09-21/22, `CLAUDE.md`), mas o comportamento em 375px
**muda**, sim, de forma on-demand — e com o achado do `cto-obra` acima, essa
mudança em 375px para PDF é abrir em nova aba, não o Lightbox embutido.

## Veredicto (po, 2026-09-23)

✅ **PRONTO PARA `/develop`.**

- **Gate 0** — fechado (`design/mocks/CONTAI-048.md`/`.html`).
- **Consulta técnica ao `cto-obra`** — respondida; correção incorporada ao
  critério 3 (PDF em tela estreita/touch abre em nova aba, não embutido).
- **Gate Fiscal** — sanity check apenas, sem regra nova esperada (ver seção
  acima); não é bloqueio.
- **Único item que não fecha por código**: a validação manual em iPhone real
  + macOS Safari com um PDF de verdade (≥ 2 páginas), listada acima — não
  impede começar o Gate 1, mas o Gate 4 (verificação) deste ticket não pode
  fechar só com Playwright/CI, porque o `webkit` do Playwright roda em Linux
  e não tem viewer de PDF nenhum: ele prova o caminho de fallback e o de
  imagem, nunca o comportamento real do Safari iOS que este ticket existe
  para servir.
