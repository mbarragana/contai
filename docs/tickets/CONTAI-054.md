# CONTAI-054 Parser determinístico sugere rótulo/valor da linha de retenção

## Tipo e Prioridade
feature — P1 — fricção de processo. Sem chamada de IA, sem cota de provedor
externo: leitura determinística de texto já embutido no PDF.

## Dor de Origem
`docs/backlog/71-2026-09-25-retencao-na-captura-e-extracao-deterministica.md`,
US-B. Palavras do Mateus: *"Dá para ler o valor direto da nota e ver se é
destacada ou não."* — só a segunda metade vira requisito aqui: para o padrão
de NFS-e municipal com campo rotulado e aritmética batendo (Total − Retenção
= Líquido), rótulo e valor são leitura de texto impresso, não julgamento
fiscal.

## User Story
Como dono da obra que já respondeu "destacada" ao gate (em qualquer tela),
quero que o sistema tente ler sozinho o rótulo exato e o valor da retenção
quando a nota tiver um padrão estruturado reconhecível, para eu só confirmar
em vez de digitar os dois campos do zero.

## Critérios de Aceite
1. [ ] Nova rota `POST /api/sugerir-retencao` recebe o PDF + o valor atual de
   `retencaoNaNota`. Se `retencaoNaNota !== "destacada"`, devolve sem
   nenhuma sugestão — a rota nunca decide o gate. Teste unitário: PDF com
   campo rotulado e gate ainda `null`/`"nenhuma"` não gera sugestão nenhuma.
2. [ ] Parser determinístico (`lib/extracao/retencao-texto.ts`, sobre o texto
   já extraído pelo `unpdf` — **sem chamar Gemini nem Groq**) procura três
   valores rotulados no texto: um rótulo casando com "total", outro com
   "líquido", e um terceiro (> 0) que é a retenção candidata. **Busca
   combinatória, não "primeiro que achar"**: pode haver MAIS DE UM rótulo
   batendo com "total" e MAIS DE UM com "líquido" na mesma nota (confirmado
   num segundo exemplo real, layout DANFSe v2.0/NFS-e Nacional, que tem
   "VALOR TOTAL DA NFS-e" e também "Valor Total Apurado" do IBS/CBS; "VALOR
   LÍQUIDO DA NFS-e" e também "VALOR LÍQUIDO DA NFS-e + IBS/CBS", este
   último zerado por ser campo da reforma tributária ainda não vigente). O
   parser testa TODAS as combinações (total_i, líquido_j) e só aceita se
   **exatamente uma** combinação tiver uma terceira linha rotulada com o
   valor da diferença — duas ou mais combinações batendo é ambiguidade e
   vira `null`, igual a nenhuma bater. Só sugere quando
   `|total − candidato − líquido| ≤ 1` centavo (tolerância de
   arredondamento). Mais de um trio que bate → nenhuma sugestão (ambiguidade
   nunca vira "melhor palpite").
3. [ ] A sugestão devolvida é só `{ rotuloLiteral, valorCentavos }` — nunca
   `composicao`, `tributo`, `e_desconto_efetivo` ou `quem_recolhe`, sem
   exceção por padrão de nota. `grep` no diff confirma zero atribuição
   automática a esses quatro campos.
4. [ ] Nenhum rótulo específico de emissor/município (ex. "ISSRF") é
   hardcoded como whitelist — o padrão reconhecido é estrutural
   (rótulo+valor+aritmética), não uma lista de nomes conhecidos por nota.
5. [ ] Fonte só texto embutido do PDF (pipeline `unpdf` do `CONTAI-052`);
   scan/foto nunca aciona esta rota.
6. [ ] `ExtracaoDocumentoSchema` (`lib/extracao/schema.ts`) **não** ganha
   campo novo — a sugestão vive num tipo próprio (`SugestaoLinhaRetencao`),
   sem `confianca`: não há promoção de confiança por aritmética bater (seção
   Gate Fiscal abaixo), e o valor sugerido é sempre apresentado para
   confirmação humana, nunca gravado sozinho.

## Out of Scope
- UI que exibe a sugestão no formulário — `CONTAI-055`.
- Generalizar para outros layouts de NFS-e sem caso real observado.
- Qualquer papel do Gemini/Groq nesta rota (é parser de texto puro).
- Extração sugerir a própria resposta do gate `retencao_na_nota` — vetado
  pelo `contador` no relato de origem.

## Gate Fiscal (Contador)
1. **Se** `retencao_na_nota` ∈ {`null`, `"nenhuma"`} **então** a extração não
   lê nem sugere `rotulo_literal`/`valor` — não participa da decisão do gate
   (parecer `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` §3,
   tabela: o gate é fato afirmado pelo Mateus, não leitura de campo). **Se**
   `retencao_na_nota = "destacada"` **e** o PDF tiver o padrão estruturado do
   critério 2 batendo **então** a extração pode sugerir `rotulo_literal` +
   `valor`, sempre por confirmação.
2. `composicao`, `tributo`, `e_desconto_efetivo`, `quem_recolhe` **nunca**
   são preenchidos pela extração, em nenhum padrão de nota, para sempre
   (mesma trava do critério 14 do `CONTAI-038`; parecer §3 — esses quatro
   campos exigem julgamento sobre o que o percentual *é*, e isso só está no
   documento e no Mateus).
3. **Decisão sobre confiança**: não cria exceção — não há promoção por
   aritmética bater. Aritmética batendo é **pré-condição de escopo** (só
   tentamos a sugestão quando a conta fecha), não voto sobre a legibilidade
   do texto-fonte. Um texto ambíguo/cortado continuaria arriscado mesmo com
   a conta batendo — tratar aritmética como promotor de confiança inverteria
   a regra "rebaixa nunca sobe" de `conferirContraFonte` (`CONTAI-052`) por
   uma exceção sem caso real (mesmo risco de "% padrão por prestador", já
   cortado no parecer §3).
4. Tolerância de arredondamento: `|Total − Retencao − Liquido| ≤ 0,01` conta
   como "bate"; acima disso, sem sugestão nenhuma — diferença maior é sinal
   de linha combinada ou campo mal identificado, exatamente o caso que o
   escopo exclui.
5. Automático: leitura de texto + geração da sugestão. Exige humano: aceitar
   ou editar, e os quatro campos de classificação fiscal, sempre.

## Viabilidade (CTO)
- **Fora do `ExtracaoDocumentoSchema`**: aquele schema é o contrato validado
  por `safeParse` nos dois provedores de IA (Gemini/Groq); esta sugestão tem
  produtor diferente (parser determinístico), timing diferente (só após o
  gate) e não tem `confianca` (não há modelo a julgar). Tipo próprio,
  mapeando 1:1 em `EntradaLinhaRetencao` de `lib/fiscal/retencao.ts`, com os
  quatro campos fiscais ausentes do tipo por construção.
- **Módulo novo**: `lib/extracao/retencao-texto.ts` (não `texto-pdf.ts`, que
  já responde "o texto presta?"/"a IA inventou?" — pergunta diferente).
  Assinatura `sugerirLinhaRetencao(texto, gate): SugestaoLinhaRetencao |
  null`, `null` para qualquer `gate !== "destacada"` (o que torna o
  critério 1 um teste unitário puro, sem rede). Aritmética em centavos
  inteiros, nunca float com 0,01.
- **Rota nova, não a existente**: `POST /api/sugerir-retencao`, chamada pela
  captura quando o gate vira "destacada" (a extração de documento roda ao
  anexar, antes do gate existir — não dá para reaproveitar a rota atual sem
  misturar dois modos de falha diferentes). Roda só
  `extrairTextoDoPdf → avaliarTexto → parser`, sem `maxDuration=60`, sem
  fallback de visão.
- **Complexidade: S** (lib) + **S** (rota/integração), com teste real (não
  mockado) usando o texto de uma NFS-e real anonimizada como fixture — mesmo
  padrão de `lib/extracao/texto-pdf-real.test.ts`.
- **Dívida nova, D75, revisada com um segundo exemplo real (2026-09-25)**:
  confirmado com duas notas reais de municípios/prestadores diferentes (uma
  em layout municipal antigo, outra no padrão nacional "DANFSe v2.0") que
  "total" e "líquido" aparecem como substring do rótulo nas duas, com a
  aritmética batendo — reduz o risco de ser coincidência de uma nota só,
  mas continua sendo **dois** exemplos, os dois de Santa Catarina. O segundo
  exemplo também revelou um risco novo (endereçado no critério 2): a mesma
  nota pode ter MAIS DE UM rótulo batendo com "total" e com "líquido" (campos
  de IBS/CBS da reforma tributária) — resolvido por busca combinatória +
  aritmética, não por "primeiro que achar". Risco residual: `unpdf` em
  layout tabular pode separar rótulo de valor, e formato de outro estado/
  regime pode não usar essas palavras — cada novo layout real vira um caso
  de teste, nunca uma regra genérica antecipada.
- **Dívida nova, D76**: o PDF é reenviado para esta rota (sem cache de
  texto por hash) — aceitável no volume da obra, cache fica para se virar
  incômodo de verdade.

## Dependências
- Bloqueado por: nenhum — lib e rota são isoláveis e testáveis sozinhas.
- Bloqueia: `CONTAI-055` (só há onde a sugestão cair depois que o `CONTAI-053`
  criar o repeater na captura).

## Perguntas Abertas
Nenhuma — a única pergunta que o `po` deixou em aberto (confiança da
sugestão) foi decidida pelo Gate Fiscal acima.

## Cenário e checagem final
**Captura** — a rota serve exclusivamente o momento de registro (não há
extração retroativa em documentos legados de `/documento/[id]`, fora de
escopo). Sem UI própria — este ticket é só lib + rota; a superfície visível
é o `CONTAI-055`. **Veredito: APROVADO**, sem Gate 0 de design (nenhuma
mudança visível ao usuário neste ticket isoladamente).
