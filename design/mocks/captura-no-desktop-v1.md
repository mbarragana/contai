# captura-no-desktop-v1 — telas de captura (`/adicionar/*`) em tela larga

## Por que este documento existe

Decisão do Mateus em 2026-09-22: as telas de captura (`app/(captura)/adicionar/*`,
casca de 430px, intocadas desde o CONTAI-040/`desktop-shell-v1.md`, que
assumia "não muda") também ganham tratamento desktop. Cobre a mais densa das
três (`documento/page.tsx`) como representante.

## Campos
- SEM CAMPOS — layout/composição apenas. Texto de consequência é cópia literal
  de `documento/page.tsx` e das constantes que importa
  (`lib/fiscal/documento.ts`, `obra.ts`, `vinculo.ts`, `retencao.ts` — ver
  "Textos").

## Cenário
Captura — sem presumir canteiro/uma mão: o gatilho é o Mateus registrando
sentado, no desktop. Momento continua sagrado (princípio 1): reduzir fricção,
não esticar o formulário em mais perguntas.

## Decisão 1 — onde a tela vive: casca própria, sem sidebar
Captura **não** entra em `app/(gestao)/` com a sidebar do `desktop-shell-v1`.
Verbo diferente: gestão é *navegar entre seções*; captura é *terminar um
registro com atenção*, e a sidebar convida a sair no meio de formulário fiscal
com pergunta obrigatória sem default. Entrada continua no "+ Novo registro" do
topbar do shell — ao escolher uma opção, a navegação faz **takeover de tela
cheia**: sidebar/topbar somem, entra a casca de captura (header mínimo:
"‹ Cancelar" + obra afirmada); ao terminar ou cancelar, volta ao shell. Mesma
rota, mesmo componente em qualquer largura — só a moldura muda com CSS, nunca
a estrutura de estado (`Fase`, campos, ordem das perguntas).

## Decisão 2 — "Passo X de Y": stepper decorativo, formulário continua 1 tela
O rótulo "Passo X de Y" (incoerência pré-existente entre `AppBar sub` e
`Rodape` — não é desta mudança, fica registrada) vira **stepper horizontal de
3 segmentos** no topo da casca (Escolher tipo → Preencher e anexar →
Confirmado), sem numeração clicável — voltar continua sendo o link "Voltar",
que já preserva estado. O formulário **não vira wizard paginado**: continua
1 página com revelação progressiva por resposta, igual ao código hoje.
Fatiar em telas separadas exigiria redesenhar a máquina de estados — fora do
pedido e desnecessário. Na largura ampla o formulário ganha uma **coluna
auxiliar (rail) à direita**, não mais campos: anexo + resumo somente-leitura
do já afirmado (Tipo, Emitente, Valor, Nota no seu CPF?, CNO impresso) — cada
linha mostra "ainda não respondido" em itálico até existir resposta; nada é
inferido. Cobre o ponto 2 do pedido (contexto dos passos anteriores ao lado)
sem wizard.

## Decisão 3 — anexo: dropzone grande + preview no rail, extração ao lado

Vazio: `.dropzone-lg` (área generosa, ícone + texto de arrastar/clicar), mesma
ajuda de hoje. Preenchido: vira `.preview` (miniatura + nome + tamanho +
"Trocar arquivo"), com "🪄 Extrair dados da nota (beta)" logo abaixo — hoje
enterrado no meio do formulário; aqui colado ao arquivo que ele lê. Banners de
extração aparecem no mesmo card do rail, sem empurrar o formulário.

## Decisão 4 — consequência nunca sai do campo que a gera

`Banner`/`Consequencia` de quarentena, gate de retenção, CNO sem obra e
vínculo com quarentena continuam **inline**, no mesmo card/pergunta de hoje —
não migram para o rail. O rail só espelha o já confirmado, nunca é onde a
pendência aparece pela primeira vez.

## Decisão 5 — piso 375px intocado

Abaixo de ~880px a grade colapsa para 1 coluna (`grid-template-areas`:
`"rail" "form"`) — rail sobe para cima do formulário, reproduzindo a ordem de
hoje (anexo é o primeiro campo do card mobile). Nenhum campo, pergunta ou
validação muda, só a moldura. "Salvar registro" continua fixo no rodapé,
escopado à coluna do formulário (mesma convenção de `detalhe-no-shell-v1.md`,
decisão 4).

⚠️ **O que sobe no piso é SÓ O ANEXO — precisão fechada no Gate 2 do
CONTAI-047 (2026-09-22), porque spec e código não podem discordar em
silêncio.** Do que este documento põe no rail e na casca, abaixo de 880px:

| Peça | < 880px (piso) | ≥ 880px (`larga`) |
|---|---|---|
| Anexo + extração (Decisão 3) | **sobe**, acima do formulário | rail, à direita |
| Resumo "até agora" (Decisão 2) | **não existe** | rail, abaixo do anexo |
| Stepper de 3 segmentos (Decisão 2) | **não existe** | topo da casca |

A razão é o critério 10 do ticket, que é mais forte que a fidelidade ao
protótipo: *"375px continua sendo piso obrigatório testado"*, e o canteiro
**continua funcionando exatamente como hoje**. Resumo e stepper são leitura, e
leitura nova acima do formulário é fricção no único momento em que o produto
promete pressa. O anexo não é leitura: ele já era o primeiro campo da tela.

Provado em `e2e/viewport.spec.ts` (projeto `mobile`, 375px) — ausência de
`[data-stepper]` e de "Resumo até agora", e o anexo acima do formulário.

## O que NÃO muda
Disciplina fiscal (anexo obrigatório no ato — diálogo §A.7.1 do CONTAI-033,
já coberto em `CONTAI-033.html`, não remockado aqui; campo vazio pergunta;
sem default fiscal); nenhum componente de campo muda por dentro (`CampoTexto`,
`Escolha`, `CampoArquivo`, só o contêiner e a área de clique/arraste); a
extração (Gemini) continua só sugerindo campo vazio, nunca `notaNoCpf` nem o
gate de retenção.

## Textos (nenhum reescrito)
| Texto | Fonte |
|---|---|
| "Você detalha isso depois, sentado..." | `DICA_GATE_DESTACADA`, `lib/fiscal/retencao.ts` |
| "Esta nota não abate a aferição desta obra..." | `CONSEQUENCIA_CNO_DA_NOTA`, `lib/fiscal/obra.ts` |
| "A nota continua sendo documentação hábil..." | `CNO_NAO_ALCANCA_O_CUSTO`, `lib/fiscal/obra.ts` |
| "pedir nota com o CNO ao prestador" | `ACAO_NOTA_SEM_CNO`, `lib/fiscal/obra.ts` |
| Textos do hub / ajuda do anexo | JSX literal de `documento/page.tsx`, `adicionar/page.tsx` |

## Perguntas em aberto (para `po`/`cto-obra`)
1. Takeover de tela cheia: rota separada (`app/(captura)/*` sem layout do
   shell) ou estado do layout de gestão que esconde a sidebar? Arquitetura.
2. Incoerência "Passo 2 de 3"/"Passo 3 de 3" já existe no código — ticket
   próprio de correção?
3. Vale o mesmo rail (anexo + resumo) para `pagamento`/`compra-cartao`, mais
   curtos e sem anexo tão central? Proponho avaliar caso a caso.

## Arquivos
- `design/mocks/captura-no-desktop-v1.html` — protótipo navegável: alterna
  Hub (passo 1) / Formulário do documento (passo 2, com rail) / Confirmado
  (passo 3) pela barra de ferramentas, e alterna largura (desktop largo/
  médio/piso 375px) para provar o colapso de grade.
- `design/mocks/captura-no-desktop-v1.md` — este documento.
