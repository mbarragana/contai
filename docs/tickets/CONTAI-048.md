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

## Escopo e Critérios de Aceite
*A fechar em `/design` — este ticket nasce sem mock; os pontos abaixo são o
que o `po` já sabe e o que fica para o Gate 0 decidir, não critério fechado.*

1. Em telas largas (acima do breakpoint que o `CONTAI-047` define), depois de
   um arquivo ser anexado, o formulário de `documento/page.tsx` mostra o
   arquivo ao lado dos campos — `<object>`/`<img>` a partir de blob URL local
   (achado do `cto-obra`: viável sem migration, sem subir o arquivo de novo,
   sem round-trip de rede).
2. **Não é obrigatório nem impede salvar** — é conveniência de conferência,
   nunca gate. Falha ao renderizar o preview (formato não suportado, PDF
   grande) não pode bloquear o registro nem virar erro de tela: degrada para
   o comportamento de hoje (arquivo só como anexo).
3. PDF multi-página: decidir no Gate 0 se mostra só a primeira página, todas
   em scroll, ou paginação — pergunta explícita para o `designer`.
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
- **Precisa de `/design` próprio**, ainda não escrito, e **não é o mesmo
  Gate 0 do `047`** — ver a ressalva em "Dor de Origem" (2026-09-22): o rail
  do `047` cobre miniatura + resumo do digitado, não a leitura do documento.
  Sem mock, este ticket não está pronto para `/develop`.

## Cenário e checagem final
**Captura em tela larga** — em casa, sentado, conferindo uma nota antes de
salvar. Não se aplica ao "Teste do Canteiro": em 375px o comportamento não
muda (critério 5).
