/**
 * Fonte ÚNICA das regras de leitura fiscal do documento (CONTAI-052, decisão
 * técnica 2). Os dois provedores — Gemini (visão, arquivo) e Groq (texto
 * extraído localmente) — montam o prompt daqui.
 *
 * Por que única: "favorecido = quem emitiu", "valorReais é o BRUTO" e "não
 * classifique retenção" não podem divergir entre provedores. Um documento
 * lido pela Groq e o mesmo documento lido pelo Gemini têm que sugerir a mesma
 * coisa — divergência aqui viraria "a extração às vezes traz o tomador", que é
 * bug invisível até a hora da declaração.
 *
 * O texto das regras é o mesmo já validado contra a API real em 2026-09-24
 * (incidente do Gemini, 3 rodadas). Mudar a redação exige testar contra API de
 * verdade nos DOIS provedores, não só rodar a suíte.
 */

/**
 * Cabeçalho + regras de campo. A regra de `confianca` NÃO está aqui de
 * propósito: o critério muda por modalidade (decisão técnica 5) e entra por
 * `montarPrompt`.
 */
export const REGRAS_EXTRACAO = `Você lê notas fiscais e boletos de uma obra de construção civil
no Brasil e devolve SOMENTE os dados que estão impressos no documento.

Regras, sem exceção:
- Nunca invente ou estime um valor. Campo que você não consegue ler com
  certeza vira \`null\` — nunca um palpite.
- "favorecidoNome" e "favorecidoDocumento" são de quem EMITIU o documento
  (o prestador/fornecedor), nunca do tomador.
- "valorReais" é o valor BRUTO do documento (o total da nota/boleto), em
  reais, com ponto decimal (ex.: 1234.56) — nunca já descontado de retenção.
- "dataEmissao" e "vencimento" saem em AAAA-MM-DD. Nota sem vencimento
  impresso (não é boleto) → \`vencimento: null\`.
- "tipo": "nf_servico" se a nota descreve prestação de serviço/mão de obra;
  "nf_material" se descreve venda de material/produto; "boleto" se o
  documento é um boleto de cobrança (não é NF).
- "classificacao": "mao_obra" para serviço, "material" para material — só
  quando o tipo já não deixar isso óbvio, senão \`null\`.`;

/**
 * Fronteira fiscal, repetida em todo prompt: retenção é classificação, não
 * leitura (parecer de 2026-09-18 + CONTAI-038, critério 14).
 */
const RODAPE_RETENCAO = `Não leia nem tente classificar retenções (INSS, ISS, CPP, etc.) — isso fica
fora do seu escopo, mesmo que a nota mostre uma linha de retenção.`;

/**
 * `confianca` no caminho de VISÃO: o que o modelo julga é a legibilidade da
 * imagem/PDF — é a redação original, validada contra a API real.
 */
export const CONFIANCA_VISAO = `- "confianca": "baixa" se o PDF está com texto cortado, ilegível ou você tem
  qualquer dúvida sobre um campo; "alta" só quando todos os campos lidos são
  nítidos e inequívocos.`;

/**
 * `confianca` no caminho de TEXTO: não há imagem para julgar legibilidade — o
 * texto já chegou decodificado. O que sobra de incerteza é AMBIGUIDADE, e é
 * exatamente o risco do pre-mortem 2 do ticket: uma nota tem o CNPJ do
 * emitente E o do tomador, e o modelo escolhe um sem sinalizar dúvida.
 */
export const CONFIANCA_TEXTO = `- "confianca": julgue AMBIGUIDADE, não legibilidade — o texto já veio
  decodificado. "alta" só quando cada campo tem um único candidato claro no
  texto; "media" quando havia mais de um candidato plausível (ex.: dois
  CNPJ/CPF, ou vários valores, e você escolheu um); "baixa" quando o texto
  está fragmentado, embaralhado, contraditório ou não parece nota/boleto.`;

/** Regras + a regra de `confianca` da modalidade + o rodapé de retenção. */
export function montarPrompt(regraConfianca: string): string {
  return `${REGRAS_EXTRACAO}\n${regraConfianca}\n\n${RODAPE_RETENCAO}`;
}

/**
 * Chaves que a resposta tem que trazer. O Gemini recebe isso como
 * `responseSchema` estruturado; a Groq roda em `json_object` (sem schema
 * estrito, decisão técnica 2 — `json_schema` só existe nos modelos de
 * raciocínio, que reproduziriam a armadilha de MAX_TOKENS da rodada 1 do
 * incidente), então para ela a lista tem que estar no próprio prompt.
 */
export const CHAVES_ESPERADAS = [
  "tipo",
  "numero",
  "serie",
  "dataEmissao",
  "vencimento",
  "favorecidoNome",
  "favorecidoDocumento",
  "valorReais",
  "classificacao",
  "confianca",
] as const;
