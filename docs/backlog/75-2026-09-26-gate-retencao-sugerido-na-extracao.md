# O gate de retenção não é sugerido pela extração — Mateus tem que clicar antes de a sugestão funcionar — 2026-09-26

## Contexto do relato

Mateus subiu uma NF do mesmo padrão que ele próprio deu como exemplo de
origem do `CONTAI-054` (a sugestão determinística de rótulo/valor da linha de
retenção). Anexou o PDF em `/adicionar/documento` e clicou em "extrair
automaticamente" (o botão do Gemini, `extrairDaNota()`, que hoje preenche
tipo/número/série/data/favorecido/valor). A retenção não veio — porque a
sugestão de linha (`sugerirLinhaRetencao`, via `POST /api/sugerir-retencao`)
só é chamada depois de o gate `retencaoNaNota` já estar respondido como
`"destacada"` (`app/(captura)/adicionar/documento/page.tsx`, efeito
`alvoDaSugestaoDeRetencao`), e ele não tinha marcado o gate à mão — só clicado
em extrair.

## Dor extraída

*"eu não espero clicar em nada, se estou anexando o pdf e mandando extrair
automaticamente, eu espero que todo o formulário seja preenchido a partir
daí, não que eu tenha que clicar em partes do formulário para que a extração
funcione."*

## Investigação técnica (dada, não repetida em detalhe)

- `lib/extracao/retencao-texto.ts:233-240` — `sugerirLinhaRetencao(texto,
  gate)` sai por `null` sem olhar o texto quando `gate !== "destacada"`. O
  comentário nas linhas 12-15 cita este parecer para justificar a trava, mas
  cita errado (ver Gate Fiscal abaixo).
- `app/api/sugerir-retencao/route.ts:44-46,64-67` — a rota só lê o PDF quando
  o form recebe `retencaoNaNota=destacada`; qualquer outro valor (inclusive
  ausente) devolve `{ sugestao: null }` sem tocar o arquivo.
- `app/(captura)/adicionar/documento/page.tsx:296-299` — `responderGateDeRetencao`
  **apaga `linhasPendentes`** sempre que a resposta não é `"destacada"`
  (mesma disciplina do `setCnoNaNota(null)` ao trocar de obra: linha
  acumulada numa nota que o gate diz não ter retenção seria afirmação órfã).
- `app/(captura)/adicionar/documento/page.tsx:322-366` — `extrairDaNota()` (o
  botão "extrair automaticamente", Gemini/`ExtracaoDocumento`) e o mecanismo
  de sugestão de retenção (`CONTAI-053`/`054`/`055`) são **dois caminhos
  paralelos, nunca conectados**: o primeiro nunca toca `retencaoNaNota`,
  `linhasPendentes`, `sugestaoRetencao` nem chama `/api/sugerir-retencao` — é
  o mesmo texto do comentário da linha 315-317 ("nunca toca notaNoCpf nem o
  gate de retenção — pergunta fiscal, não leitura de PDF"), escrito antes de
  o ADENDO 5 existir.

## Gate Fiscal já fechado

**ADENDO 5, 2026-09-26**, em
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`. O `po` levou o
relato ao `contador` antes de abrir ticket. Resumo (texto completo no
parecer, não repetir na íntegra em ticket):

- `retencaoNaNota` ("a nota destaca retenção?") é **fato objetivamente
  legível** no papel — mesma categoria de data de emissão ou CNPJ — e
  **categoricamente diferente** de `quem_recolhe`/`composicao`/
  `natureza_da_retencao`, que continuam 100% proibidos de sugestão, sem
  exceção e sem mudança nenhuma.
- Aprovado: o parser pode **sugerir** o gate como `"destacada"` (nunca
  `"nao_destacada"` nem `"nao_sei"` — ausência de padrão não prova ausência
  de retenção), sempre **junto** com a linha (rótulo + valor), na mesma
  leitura, na mesma ação — nunca separado, nunca gravado até "Salvar
  registro".
- Quatro salvaguardas obrigatórias (§3 do ADENDO): (1) sugestão nunca
  afirmação, com o trecho literal (rótulo+valor) visível ao lado para
  conferência; (2) só sugere "destacada", nunca "não destacada"; (3) nunca
  sugere "não sei"; (4) gate e linha se sugerem juntos, na mesma ação — nunca
  o gate sozinho.
- `notaNoCpf` **não é tocado** — continua fora de qualquer sugestão, decide
  admissibilidade do documento inteiro, pergunta diferente por natureza (§1
  do ADENDO).
- O comentário em `lib/extracao/retencao-texto.ts:12-15` está desatualizado
  (cita o parecer para uma leitura que o próprio parecer nunca sustentou —
  ver "resposta desconfortável primeira" do ADENDO 5) e precisa ser corrigido
  na implementação, para não voltar a ser lido como proibição.

## Classificação

**P1 — fricção de processo**, não P0 fiscal. Nenhum campo de classificação ou
valor de custo/aferição é afetado (esses continuam manuais, ADENDO 2/3
inalterados); o efeito é só a experiência de captura não corresponder à
expectativa que o próprio botão "extrair automaticamente" cria. A dor já
causou uma extração "incompleta" percebida pelo Mateus numa nota que ele
mesmo forneceu como exemplo de origem do `CONTAI-054` — sinal de que vai se
repetir toda vez que uma NF do padrão reconhecido for extraída sem o gate
pré-marcado.

## Vira ticket

`CONTAI-062` — Passo 1 (`po`) e demais Gates rodados no mesmo dia,
`docs/tickets/CONTAI-062.md`.

## O que NÃO foi feito aqui

- Não foi escrito mock (`design/mocks/`) — Passo 4 do `/tickets-req`, corre
  junto com a criação do ticket.
- Decisão de QUANDO a sugestão do gate dispara (no clique de "extrair
  automaticamente", ou num efeito próprio quando o PDF já está anexado,
  independente do botão) é do `cto-obra` no Gate de viabilidade — este
  registro não prescreve.

## Achado do Gate 2, não bloqueante (2026-09-26)

Troca de anexo não invalida nada digitado À MÃO no formulário (linha manual,
número, série, data, valor, favorecido) — só a sugestão morre com o papel
(critério 7/salvaguardas do ADENDO 5, cobertas em `6.6`/`6.7` de
`e2e/captura-retencao-desktop.spec.ts`). Isso é **comportamento consistente
com o resto do formulário** (nenhum outro campo digitado é apagado ao trocar
o anexo) — não é regressão nem dívida fiscal. Avaliar no futuro, como
produto/design e não como regra fiscal, se a tela deveria avisar quando ela
já tem conteúdo digitado e o anexo muda por baixo dele.
