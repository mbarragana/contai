# CONTAI-090 — quebrar "Excedente da nota" (fornecedor vs. retenção a recolher)
Cenário: gestão (revisão de documento, sentado — `/documento/[id]`)

**Nível 2** — delta num card já em produção (`PagamentosDesteDocumento`,
`app/(gestao)/documento/[id]/page.tsx:288-302`). Sem rota, sem campo novo,
sem estado de loading/vazio/erro novo (condição de existir é a mesma de hoje:
`alocado && faltaPagamentoCentavos > 0`). Só muda como o valor já certo
se decompõe visualmente.
## Cálculo (antes da tela)
Por linha de `documento.retencoes`: `motivoDaRetencaoAberta(linha,
notaCoberta)` (já existe). Filtrar `"eu_sem_guia"` → agrupar por
`nomeDaRetencao(linha)`, somando `valorCentavos`, ordem de 1ª aparição.
`somaPendente` = soma dos grupos. `aPagar = faltaPagamentoCentavos −
somaPendente`. `quebra = somaPendente > 0 && somaPendente <= faltaPagamentoCentavos`.
⚠️ `aPagar` também carrega fração `sem_recolhedor`/não respondida já dentro de
`faltaPagamentoCentavos` — decompor esse outro motivo é "Fora de escopo"
explícito do ticket (`docs/backlog/105-...md`), não lacuna deste spec.
## Telas e estados
**(a) Nenhuma linha `eu_sem_guia`** (`quebra=false`, caso comum) — idêntico a
hoje, byte a byte:
```
Linha "Excedente da nota"   R$ 34.901,00 — nota ainda não paga
Consequencia(amb): "Este pedaço da nota não vira custo: regime de
caixa — sem desembolso não há dispêndio. Ele passa a contar quando
o pagamento existir e for ligado aqui."
```
**(b) 1 grupo `eu_sem_guia`, X>0** (caso PerfuraTec):
```
EXCEDENTE DA NOTA              ← rótulo de GRUPO, texto simples, sem Linha
A pagar ao fornecedor    R$ 33.103,97
[Consequencia âmbar — mesmo parágrafo de (a), só sobre esta linha]
ISS a recolher (guia pendente)   R$ 1.797,03
[Chip: Guia de retenção pendente]
```
Sem parágrafo na linha de retenção — `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA` já
aparece completa mais abaixo, no card da própria linha (`BlocoRetencao`);
decisão do `cto-obra`, não repetir.

**(c) X=0** (caso Francisco/JA SILVA): a linha "A pagar ao fornecedor" e seu
parágrafo **somem por inteiro** — nunca "R$ 0,00 — nota ainda não paga":
```
EXCEDENTE DA NOTA
ISS a recolher (guia pendente)   R$ 1.797,03
[Chip: Guia de retenção pendente]
```
**(d) 2+ tributos (ISS + INSS)**: uma linha por grupo, fornecedor primeiro se
X>0, grupos na ordem de 1ª aparição na nota:
```
EXCEDENTE DA NOTA
A pagar ao fornecedor            R$ 31.306,94
[Consequencia âmbar]
ISS a recolher (guia pendente)   R$ 1.797,03
[Chip: Guia de retenção pendente]
INSS a recolher (guia pendente)  R$ 1.797,03
[Chip: Guia de retenção pendente]
```
Grupo não discriminado: rótulo "retenção não discriminada a recolher (guia
pendente)" (constante nova, ver "Textos" abaixo).

**(e) `somaPendente > faltaPagamentoCentavos`** (dado contraditório) —
`quebra=false`. Fallback: bloco de (a), sem alteração. Convive sem conflito
com `RETENCAO_SOBRECOBERTA` (checagem separada, mais abaixo no card).
## Hierarquia visual
- Ordem: fornecedor antes de retenção(ões) — pagar o fornecedor é a decisão
  mais urgente; a guia já tem card de ação próprio mais abaixo.
- Cor nunca escolhida aqui: fornecedor usa `text-amb` (como hoje); retenção
  usa `TEXTO_DA_RETENCAO_ABERTA.eu_sem_guia.gravidade` (hoje também `amb` —
  intencional, as duas são "dinheiro que ainda não saiu").
- Diferenciação por **rótulo + chip**, não por cor: só retenção leva `Chip`
  `CHIP_RETENCAO_GUIA_PENDENTE`; fornecedor não leva chip.
- Mesmo nível/indentação, itens-irmãos do grupo "Excedente da nota"; rótulo
  de grupo só aparece quando `quebra=true`.
## Campos / Navegação
- SEM CAMPOS — bloco só de LEITURA: nenhum input novo, nenhuma validação nova
  e nenhuma navegação nova (mesma tela, mesmo card). O ticket só decompõe
  visualmente um valor que `alocarCusto` já produz.
## Textos com consequência fiscal
- `CONSEQUENCIA_RETENCAO_EU_SEM_GUIA`, `CHIP_RETENCAO_GUIA_PENDENTE`,
  `TEXTO_DA_RETENCAO_ABERTA.gravidade`, `nomeDaRetencao()` —
  `lib/fiscal/retencao.ts`, verbatim; o parágrafo **não** se repete aqui (só
  o chip) — decisão já tomada do `cto-obra`.
- "Este pedaço da nota não vira custo: regime de caixa — sem desembolso não
  há dispêndio. Ele passa a contar quando o pagamento existir e for ligado
  aqui." — já existe em `page.tsx:296-300`, mantido byte a byte, reposicionado
  para a linha "A pagar ao fornecedor".
- `ROTULO_RETENCAO_NAO_DISCRIMINADA_RECOLHEDOR_CONFIRMADO` = "retenção não
  discriminada" — ainda não existe em código; já ratificada pelo `contador`
  (D92, `docs/backlog.md:215`) para este ticket. Não é texto meu: correção já
  decidida, consumida aqui no rótulo do grupo não discriminado.
- Nenhum outro texto fiscal foi escrito ou parafraseado.
## Decisões de design e perguntas abertas
- Decisão: rótulo do grupo é `${nomeDaRetencao(linha)} a recolher (guia
  pendente)` (ex. "ISS a recolher"), não o genérico do relato — precisa
  diferenciar 2+ grupos no estado (d) sem repetir rótulo.
- Pergunta ao `contador`, só se achar o rótulo acima problemático: o padrão
  `"${tributo} a recolher"` mantém a cautela do A.2 (nunca compor "guia de
  X" quando não discriminado)? Leitura minha, não está no parecer.
