# CNO automático contraria o parecer do `contador` — decisão do Mateus, registrada com transparência — 2026-09-27

## Contexto

O Mateus testou o `CONTAI-062` (sugestão automática do gate de retenção) numa
nota real (Palhoça/SC, mesma nota do `CONTAI-068`) e, a partir do mesmo
instinto — "o parser já lê o texto, por que não usar mais?" — pediu duas
extensões no mesmo fôlego. As duas foram ao `contador` no mesmo parecer
(`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`), porque nasceram da
mesma pergunta mas pedem respostas diferentes pelo mesmo método: não é só
"fato vs. intenção" (ADENDO 5 do parecer de 2026-09-18) — é fato **e** o que
acontece depois que o Mateus aceita a sugestão sem reler o papel.

## Dor 1 — sugerir `tributo` a partir do rótulo lido

> "por que o campo `tributo` (e o botão 'Tributo único') não são preenchidos
> junto [com a linha de retenção]?"

**Classificação**: pedido de automação sobre campo fiscal banido de sugestão.
**Não é dor nova** — o `CONTAI-038`, critério 14, já proíbe sugerir
`composicao`, tributo específico, `e_desconto_efetivo` e `quem_recolhe`, e o
pre-mortem 2 do mesmo ticket (2026-09-20) **já nomeou por antecipação** este
exato pedido.

**Parecer do `contador`**: REPROVADO, sem exceção. Mapear rótulo→categoria
legal (`iss|inss|irrf|pis|cofins|csll`) é interpretar texto livre contra
taxonomia jurídica, não ler um fato aritmético — o corpus do próprio projeto
já tem contraexemplo ("Total das Retenções (ISSQN/Federais)", nota de
2026-09-25) que quebraria qualquer regra de palavra-chave. Errar classifica
silenciosamente uma retenção relevante à aferição como puramente municipal,
apagando a pendência sem rastro.

**O Mateus concordou com a reprovação.** Não vira ticket de auto-preenchimento.

**Alternativa aprovada pelo `contador`**: exibir o rótulo bruto já lido
(`rotuloLiteral`) como texto de apoio ao lado do dropdown de `tributo` — nunca
setando o campo. Vira ticket separado, menor.

## Dor 2 — detectar CNO impresso e marcar `cnoNaNota = "desta_obra"` automaticamente

> "eu discordo e quero que implemente. não terá dúvida neste ponto. No
> momento que o CNO bater iguais não haverá dúvida e erro. É número, ou é
> igual ou não é."

**Classificação**: decisão de produto sobre apetite de risco — o dono do
projeto sobrepondo recomendação fiscal. Legítimo, registrado por inteiro.

### 1º parecer do `contador` (mesmo dia, antes da contestação)

Parcialmente reprovado. Leitura (achar número rotulado "CNO"/"Matrícula CEI"
e comparar com o CNO da obra) pode ser automática; **marcar o campo sozinho,
não** — mesmo como sugestão a confirmar. Diferença do caso já aprovado
(retenção): o raio de efeito. `retencaoNaNota` errado abre uma seção
revisável, sem custo silencioso. `cnoNaNota = "desta_obra"` errado entra
direto em `baseCentavos` da aferição INSS (Meta 2), um proxy que o próprio
sistema já reconhece como superestimado (dívida D57) — e é a ÚNICA das três
respostas do gate que, no espelho (`outra_obra`), o `CONTAI-007` já trata
como erro sem conserto (bloqueia o salvamento). Recomendação original:
exibir os dois números lado a lado, sem veredito, campo continua vazio.

### O Mateus contestou

Comparou com `garantirFavorecido` (dedup de favorecido por CPF/CNPJ, hoje
automática e silenciosa, sem gate de confirmação) e perguntou por que
correspondência EXATA de dígitos não bastaria aqui.

### 2º parecer do `contador` (ADENDO, mesmo arquivo) — reexame, mantém a reprovação, corrige o argumento

O `contador` foi ao código conferir o precedente antes de responder (não
opinou de memória). Resultado:

- **Concede integralmente**: sob correspondência exata, a leitura é tão
  "fato" quanto a aritmética da retenção — e comparação de máquina entre dois
  números de 12+ dígitos é **mais confiável** que a comparação visual que a
  recomendação original ainda pedia ao Mateus fazer de cabeça (o próprio
  `CONTAI-007`, pre-mortem 1, já proíbe pedir para ele *digitar* um CNO de
  cabeça — por coerência, também deveria desconfiar de pedir para ele *ler e
  comparar* de cabeça).
- **Retira** a frase da 1ª resposta ("indistinguível de resposta manual
  correta, sem rastro") como argumento contra a automação — é verdade, mas
  também é verdade de uma resposta manual, não diferencia os dois casos.
- **Argumento que sustenta a reprovação, agora nomeado com precisão**: trocar
  "decidir" por "confirmar uma decisão que o sistema já tomou" é mudança de
  tarefa cognitiva (vigilância degradada / complacência de automação),
  aplicada exatamente ao único dos três campos da família em que o próprio
  `CONTAI-007` já tratou a direção "incluir" como sem conserto.
- **`garantirFavorecido` não transfere como precedente**: lá a chave é
  identidade jurídica fechada (mesmo CPF/CNPJ = mesma pessoa, por definição;
  o risco documentado é só o oposto — dígito errado *separando* o que devia
  ser um favorecido só) e "juntar" nunca foi tratado como perigoso. Em
  `cnoNaNota`, a pergunta é elegibilidade fiscal (esta nota conta ou não na
  base que o CRC assina), e a direção equivalente a "juntar" (`desta_obra`) é
  exatamente a que o sistema já trata com mais cautela.
- **Recomendação de UX revisada**: computar o veredito da igualdade exata e
  exibi-lo em texto ("números idênticos"/"diferentes") — entrega o ganho de
  confiabilidade sem entregar o ato de marcar o campo. Mantida a reprovação
  de marcar `desta_obra` sozinho, mesmo sob as três condições do Mateus.
- Achado à margem (fora do escopo desta pergunta, registrado para não
  desaparecer): não existe, hoje, análise de risco escrita para
  falso-positivo do `garantirFavorecido` (duas identidades reais colididas
  por engano) nem caminho implementado para desfazer essa colisão — sugestão
  do `contador` ao `po`/`cto-obra` de abrir item de backlog separado.

### Decisão final do Mateus — sobrepõe a recomendação

Depois de ouvir a resposta refinada, o Mateus manteve o pedido: implementar a
marcação automática completa de `desta_obra` quando os dígitos baterem exato.
Isso é decisão de apetite de risco do dono do produto, não erro de
especificação — registrada aqui com o parecer completo ao lado, para que a
responsabilidade da escolha fique visível a quem ler o histórico depois,
inclusive ao próprio Mateus revisando isto no futuro.

## ADENDO — mesmo dia — a decisão do Mateus se estende ao `tributo`

Depois desta entrada estar registrada e o `cto-obra` já ter sido acionado
para especificar o ticket do CNO (mais a alternativa de "dica de texto" para
o tributo, ainda dentro do que o `contador` tinha aprovado), o Mateus mudou o
pedido em cima do que estava em voo: *"aplique a mesma abordagem ao
tributo"*. **A alternativa de "dica de texto" da Dor 1 fica obsoleta.** O que
entra no lugar é a MESMA família de decisão do CNO — sugestão automática,
nunca fato até "Salvar registro", mesma linguagem visual (pílula/seleção
âmbar + selo "Sugerida") — aplicada a `tributo`, sobrepondo a reprovação
original do parecer ("REPROVADO, sem exceção", Dor 1 acima), com a mesma
transparência: a reprovação fica citada, a decisão de implementar mesmo
assim é do Mateus.

**A diferença técnica entre os dois campos não desaparece — vira salvaguarda
de implementação, não motivo para recusar o pedido:**

- `cnoNaNota`: igualdade EXATA de dígitos — bate ou não bate, sem meio-termo.
- `tributo`: mapear um RÓTULO DE TEXTO para 1 de 6 categorias legais fixas
  (`iss|inss|irrf|pis|cofins|csll`) — o próprio parecer de hoje (ADENDO 6/7)
  mostrou um rótulo real e composto, "Total das Retenções (ISSQN/Federais)",
  que não aponta para uma categoria só.

**Salvaguarda obrigatória, a virar critério do ticket**: só sugerir uma
categoria quando o rótulo nomeá-la de forma INEQUÍVOCA E EXCLUSIVA — contém
palavra-chave de uma única categoria, sem mistura com outra. Rótulo
composto/ambíguo (o próprio exemplo real do ADENDO 6/7) não sugere nada —
mesma doutrina "ambíguo vira silêncio, nunca melhor palpite" que já rege o
resto do parser de retenção. A sugestão de rótulo/valor da LINHA de retenção
em si (`CONTAI-054`/`062`) é decisão independente e continua funcionando
mesmo quando `tributo` não é sugerido por ambiguidade.

`cto-obra` (acionado com a correção antes de fechar a resposta) define a
lista de palavras-chave por categoria e a regra de desambiguação como decisão
técnica.

## O que vira ticket

1. **CNO automático** (`cto-obra` especifica, `designer` desenha) — marcar
   `cnoNaNota = "desta_obra"` como SUGESTÃO (mesma linguagem visual do
   `CONTAI-062`: pílula âmbar + selo "Sugerida", nunca cor de resposta manual)
   quando o parser achar um número claramente rotulado CNO/"Cadastro Nacional
   de Obras"/"Matrícula CEI" com igualdade EXATA contra o CNO cadastrado da
   obra. Nunca sugere `outra_obra` nem `nao_traz`. Troca de anexo invalida a
   sugestão (mesma correção do Gate 2 do `CONTAI-062`). Gate Fiscal do ticket
   cita os dois pareceres do `contador` (reprovação original + decisão do
   Mateus de implementar mesmo assim).
2. **`tributo` automático** (substitui a "dica de texto" da Dor 1, obsoleta
   pelo ADENDO acima) — marcar `tributo` como SUGESTÃO, mesma linguagem
   visual, só quando o rótulo lido casar de forma inequívoca e exclusiva com
   uma única categoria; ambíguo ou sem match = silêncio. Gate Fiscal cita a
   reprovação original ("sem exceção") e a extensão da decisão do Mateus
   registrada neste ADENDO. `cto-obra` confirma se cabe junto do ticket 1
   (mesma tela, mesma família de decisão) ou fica isolado (`CONTAI-070`).

## Perguntas abertas

Nenhuma bloqueante para abrir os tickets — o `cto-obra` especifica os
critérios técnicos (formato de rótulo aceito, normalização de dígitos,
palavras-chave por categoria de tributo e regra de desambiguação) e o
`designer` desenha o(s) mock(s) nível 2, mesma classe do `CONTAI-062`.

## O que fica fora

- Automação de `outra_obra`/`nao_traz` — nunca cogitado, segue 100% manual,
  sem divergência entre `contador` e Mateus neste ponto.
- Preenchimento de `composicao`, `e_desconto_efetivo`, `quem_recolhe`,
  `natureza_da_retencao` — intocados, critério 14 do `CONTAI-038` continua
  valendo sem exceção.
- Análise de risco do `garantirFavorecido` (achado à margem do ADENDO) — vira
  item de backlog **separado**, não entra em nenhum dos dois tickets desta
  entrada.
