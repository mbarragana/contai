/**
 * Estágio 1 do pipeline de extração (CONTAI-052): ler o texto embutido do PDF
 * **localmente, sem chamar API nenhuma**, e decidir se esse texto presta.
 *
 * Por que existe: a maioria das NF-e/NFS-e/boleto é gerada por sistema e tem
 * camada de texto — mandar o PDF para uma IA de visão nesses casos gasta a
 * cota apertada do Gemini (5 req/min no tier gratuito, medido em 2026-09-24)
 * por nada.
 *
 * O risco central do ticket está aqui: **PDF-imagem processado como se fosse
 * texto legível**. Um scan sem OCR devolve string vazia (fácil), mas uma fonte
 * sem `ToUnicode` devolve caracteres embaralhados que *parecem* texto — e a IA
 * inventaria um valor plausível em cima do lixo. Daí as duas defesas deste
 * módulo: `avaliarTexto` antes de chamar a IA, e `conferirContraFonte` depois.
 *
 * Biblioteca: `unpdf` (decisão técnica 1). Não `pdf-parse` (arrasta
 * `@napi-rs/canvas`, binário nativo) nem `pdfjs-dist` puro (worker manual).
 */

import type { ExtracaoDocumento } from "@/lib/extracao/schema";

/**
 * Teto de payload mandado à Groq. 30k caracteres cobre com folga uma NF-e de
 * várias páginas; acima disso é memorial/contrato anexado ao PDF, não a nota —
 * e mandar tudo só encareceria o prompt e aumentaria a chance de o modelo
 * pescar o CNPJ errado.
 */
export const LIMITE_CARACTERES = 30_000;
/** Dados da nota estão sempre nas primeiras páginas; o resto é anexo. */
export const LIMITE_PAGINAS = 5;

/**
 * (a) Volume. O limiar é conservador de propósito: ele não existe para julgar
 * qualidade, só para descartar o PDF-imagem que devolve um metadado solto ou
 * um cabeçalho de página vazio.
 *
 * **Medido na sondagem (2026-09-25, PDF gerado localmente, não commitado)**: uma
 * NFS-e de 14 linhas — só o esqueleto de uma nota, menos texto que qualquer
 * nota real — extraiu **620 caracteres não-brancos, 0% de lixo**. 200 é ~1/3
 * disso. Sondagem NÃO incluiu scan/foto real da obra (pre-mortem 1 do ticket):
 * o caso está coberto por fixture sintética no teste, não por medição.
 */
export const MINIMO_CARACTERES_NAO_BRANCOS = 200;

/**
 * (b) Proporção de caracteres-lixo. PDF com fonte sem `ToUnicode` devolve
 * `(cid:N)` ou U+FFFD no lugar das letras — é o caso que engana, porque tem
 * volume. 5% é folga para um símbolo exótico isolado (logotipo vetorizado,
 * caractere de caixa de formulário), não para um documento inteiro
 * mal-decodificado.
 */
export const MAXIMO_PROPORCAO_LIXO = 0.05;

/**
 * (c) Âncoras. Nota/boleto de obra SEMPRE tem um CNPJ/CPF e um valor em reais
 * impressos. Texto embaralhado não produz nem um nem outro — os dois padrões
 * exigem estrutura de dígitos e pontuação que lixo de decodificação não
 * reproduz por acidente.
 */

/**
 * CNPJ (`00.000.000/0000-00`), CPF (`000.000.000-00`) ou o mesmo sem
 * pontuação. Na forma crua exigimos a fronteira de não-dígito para não casar
 * um trecho qualquer de linha digitável de boleto por acidente — e ainda
 * assim: esta é uma âncora de "parece documento fiscal", não validação de
 * dígito verificador (essa vive em `lib/fiscal/`, e não é papel da extração).
 */
const RE_DOCUMENTO =
  /(?<!\d)(?:\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{14}|\d{11})(?!\d)/;

/**
 * Valor monetário pt-BR: vírgula com exatamente duas casas, com ou sem
 * separador de milhar. `1.234,56`, `47,00`, `1234,56` passam; `2026-09-24` e
 * `12,5` não.
 */
const RE_VALOR_BRL = /(?<!\d)\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)|(?<!\d)\d+,\d{2}(?!\d)/;

/** `(cid:N)` — fonte embutida sem mapa `ToUnicode`. */
const RE_CID = /\(cid:\d+\)/g;

/**
 * U+FFFD (replacement), controles C0/C1 (menos tab/LF/CR) e private use area —
 * os três sintomas de texto extraído de fonte sem mapeamento correto.
 */
const RE_LIXO =
  /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uE000-\uF8FF]/g;

export type MotivoInsuficiente = "curto" | "lixo" | "sem_ancora";

export type AvaliacaoTexto = {
  suficiente: boolean;
  /** `null` quando suficiente; o primeiro teste que reprovou, quando não. */
  motivo: MotivoInsuficiente | null;
  caracteresNaoBrancos: number;
  proporcaoLixo: number;
  temDocumento: boolean;
  temValor: boolean;
};

/**
 * Os três testes cumulativos da decisão técnica 4, na ordem em que reprovam
 * mais barato. Tudo que reprova aqui cai no caminho de hoje (Gemini, visão) —
 * reprovar é degradar, nunca falhar.
 */
export function avaliarTexto(texto: string): AvaliacaoTexto {
  const cid = texto.match(RE_CID) ?? [];
  // `(cid:N)` conta pelo tamanho do token: são 7+ caracteres substituindo UMA
  // letra, e contar como 1 subestimaria a poluição em uma ordem de grandeza.
  const caracteresCid = cid.reduce((soma, token) => soma + token.length, 0);
  const caracteresLixo = (texto.match(RE_LIXO) ?? []).length;

  const naoBrancos = texto.replace(/\s/g, "").length;
  const proporcaoLixo =
    naoBrancos === 0 ? 0 : (caracteresCid + caracteresLixo) / naoBrancos;

  const temDocumento = RE_DOCUMENTO.test(texto);
  const temValor = RE_VALOR_BRL.test(texto);

  const base = {
    caracteresNaoBrancos: naoBrancos,
    proporcaoLixo,
    temDocumento,
    temValor,
  };

  if (naoBrancos < MINIMO_CARACTERES_NAO_BRANCOS) {
    return { suficiente: false, motivo: "curto", ...base };
  }
  if (proporcaoLixo > MAXIMO_PROPORCAO_LIXO) {
    return { suficiente: false, motivo: "lixo", ...base };
  }
  if (!temDocumento || !temValor) {
    return { suficiente: false, motivo: "sem_ancora", ...base };
  }
  return { suficiente: true, motivo: null, ...base };
}

/**
 * ⚠️ **O PDF.js REJEITA `Buffer`** — lança
 * "Please provide binary data as `Uint8Array`, rather than `Buffer`", e um
 * `Buffer` do Node passa em `instanceof Uint8Array` (é subclasse), então o
 * TypeScript não acusa nada. Foi o bug BLOQUEANTE achado no Gate 2 do
 * CONTAI-052: com `Buffer`, o `catch` daqui engolia a exceção e TODO documento
 * caía em silêncio no Gemini — o estágio de texto nunca rodaria em produção, e
 * nenhum teste com `unpdf` mockado pegaria isso.
 *
 * A normalização fica aqui, no ponto de estrangulamento, e não só em quem
 * chama: a restrição é do PDF.js, e chamador nenhum deveria precisar saber
 * dela. `new Uint8Array(buffer, byteOffset, byteLength)` é uma VIEW, não uma
 * cópia — não duplica o PDF na memória da função serverless.
 */
function comoUint8ArrayPuro(bytes: Uint8Array): Uint8Array {
  if (bytes.constructor === Uint8Array) return bytes;
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Lê o texto embutido do PDF. `null` quando não dá — PDF criptografado,
 * corrompido, ou qualquer erro do PDF.js. Nunca lança: falhar aqui significa
 * "segue para a visão", não "a extração quebrou".
 *
 * Coberto por teste SEM mock do `unpdf` (`texto-pdf-real.test.ts`) — é o único
 * que prova que o estágio funciona de ponta a ponta.
 */
export async function extrairTextoDoPdf(
  bytes: Uint8Array,
): Promise<{ texto: string; paginas: number } | null> {
  try {
    // Import dinâmico: o `unpdf` embute o worker do PDF.js e não deve entrar
    // no caminho de quem está com o estágio de texto desligado.
    const { extractText } = await import("unpdf");
    // `mergePages: false` de propósito, mesmo querendo o texto junto: é o que
    // permite cortar em LIMITE_PAGINAS antes de juntar.
    const { totalPages, text } = await extractText(comoUint8ArrayPuro(bytes), {
      mergePages: false,
    });
    const paginas = text.slice(0, LIMITE_PAGINAS);
    const texto = paginas.join("\n").slice(0, LIMITE_CARACTERES);
    return { texto, paginas: Math.min(totalPages, LIMITE_PAGINAS) };
  } catch (erro) {
    console.warn(
      "[texto-pdf] não foi possível ler o texto embutido:",
      erro instanceof Error ? erro.message : String(erro),
    );
    return null;
  }
}

/** Só os dígitos — `11.444.777/0001-61` e `11444777000161` viram a mesma coisa. */
function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Como um valor pode aparecer impresso: pt-BR com e sem milhar, e a forma com
 * ponto decimal (alguns sistemas imprimem `1234.56`).
 */
function grafiasDoValor(valor: number): string[] {
  const comPonto = valor.toFixed(2);
  const [inteiro, centavos] = comPonto.split(".");
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return [comPonto, `${inteiro},${centavos}`, `${comMilhar},${centavos}`];
}

/**
 * A grafia tem que aparecer como NÚMERO INTEIRO no texto, não como pedaço de
 * outro número. `includes` puro achava `18.75` dentro de `18.750,00` e aprovava
 * um valor errado por um fator de 1000 — exatamente o tipo de erro que esta
 * conferência existe para barrar, e o mais caro de todos no custo de aquisição.
 *
 * As fronteiras excluem dígito, ponto e vírgula dos dois lados: `1.234,56` não
 * casa dentro de `41.234,567`, e `562,50` não casa dentro de `1.562,50`.
 */
function apareceComoNumero(texto: string, grafia: string): boolean {
  const escapada = grafia.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\d.,])${escapada}(?![\\d.,]*\\d)`).test(texto);
}

/**
 * Segunda defesa, DEPOIS do `safeParse` (decisão técnica 4). Um campo só fica
 * preenchido se o valor aparecer de fato no texto que foi mandado ao modelo.
 *
 * Existe para o cenário exato do pre-mortem 1: o texto extraído era lixo de um
 * PDF-imagem que passou raspando pela heurística, e o modelo devolveu um CNPJ
 * e um valor plausíveis — inventados. Aqui eles voltam para `null` e a
 * `confianca` cai.
 *
 * Só `favorecidoDocumento` e `valorReais` são conferidos. Data e número da
 * nota ficam fora: aparecem em várias grafias e várias vezes no mesmo
 * documento (data de emissão, de competência, de vencimento; número da nota,
 * do pedido, da parcela), e a conferência viraria falso positivo — barulho sem
 * proteção.
 *
 * A `confianca` só REBAIXA, nunca sobe: um documento que o modelo já marcou
 * como "baixa" não vira "alta" por ter passado na conferência.
 */
export function conferirContraFonte(
  extraido: ExtracaoDocumento,
  textoBruto: string,
): ExtracaoDocumento {
  const digitosDoTexto = apenasDigitos(textoBruto);
  const resultado = { ...extraido };
  let rebaixar = false;

  if (resultado.favorecidoDocumento !== null) {
    const digitos = apenasDigitos(resultado.favorecidoDocumento);
    // Comparação na projeção só-dígitos do texto: cobre o CNPJ impresso
    // formatado (`11.444.777/0001-61`) contra o campo cru do schema.
    if (digitos.length === 0 || !digitosDoTexto.includes(digitos)) {
      console.warn(
        "[texto-pdf] favorecidoDocumento não aparece no texto extraído — descartado.",
      );
      resultado.favorecidoDocumento = null;
      rebaixar = true;
    }
  }

  if (resultado.valorReais !== null) {
    const aparece = grafiasDoValor(resultado.valorReais).some((grafia) =>
      apareceComoNumero(textoBruto, grafia),
    );
    if (!aparece) {
      console.warn(
        "[texto-pdf] valorReais não aparece no texto extraído — descartado.",
      );
      resultado.valorReais = null;
      rebaixar = true;
    }
  }

  if (rebaixar) resultado.confianca = "baixa";
  return resultado;
}
